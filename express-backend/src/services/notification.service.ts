import { prisma } from "../config/prisma.js";
import { NOTIFY, SEVERITY_RANK } from "../config/constants.js";
import { emailConfigured, sendEmail, type SendResult } from "../lib/mailer.js";
import { sendSms, smsConfigured } from "../lib/sms.js";
import { emitAlert } from "../lib/realtime.js";
import { getSettings } from "./settings.service.js";
import type { DeliveryQuery } from "../zod/alert.schemas.js";

/**
 * What happens after an alert is raised.
 *
 * `NotificationSettings` and `NotificationRule` have been readable and writable from
 * the settings page since they were added, and nothing has ever consulted them - the
 * channels were configuration with no consumer. This is the consumer.
 *
 * Two gates, and both have to open:
 *
 *   1. the master channel toggle   (`notifications.channels.email`)
 *   2. the per-event rule          (`NotificationRule` where event = the alert type)
 *
 * An alert type with no matching rule falls back to in-app only. That is deliberate -
 * a detector added later should show up in the bell without silently acquiring the
 * right to send SMS to everyone.
 *
 * Every attempt writes a `NotificationDelivery` row, including the ones that were
 * never made. A channel that was disabled and a channel whose provider is missing are
 * both `SKIPPED` with a reason, so the settings page can answer "why did nothing
 * arrive?" instead of showing an empty log.
 */

export type Channel = "IN_APP" | "EMAIL" | "SMS";
type Severity = keyof typeof SEVERITY_RANK;

export interface NotifiableAlert {
  id: string;
  severity: string;
  type: string;
  title: string;
  sku: string | null;
  location: string;
  warehouseId: string | null;
  productId: string | null;
  businessImpact: string;
  recommendedAction: string;
}

interface NotificationRuleRow {
  event: string;
  inApp: boolean;
  email: boolean;
  sms: boolean;
}

interface Attempt {
  channel: Channel;
  status: "SENT" | "FAILED" | "SKIPPED";
  recipient: string | null;
  error: string | null;
}

const isSeverity = (value: string): value is Severity => value in SEVERITY_RANK;

/** In-app carries everything; only the channels that interrupt someone are gated. */
const meetsSeverityFloor = (severity: string): boolean =>
  isSeverity(severity) && SEVERITY_RANK[severity] <= SEVERITY_RANK[NOTIFY.minSeverity];

const skipped = (channel: Channel, reason: string): Attempt => ({
  channel,
  status: "SKIPPED",
  recipient: null,
  error: reason,
});

const fromSendResult = (channel: Channel, result: SendResult): Attempt => ({
  channel,
  status: result.status,
  recipient: result.recipient,
  error: result.status === "SENT" ? null : result.status === "SKIPPED" ? result.reason : result.error,
});

const subjectOf = (alert: NotifiableAlert) =>
  `[${alert.severity.toUpperCase()}] ${alert.title}`;

const bodyOf = (alert: NotifiableAlert) =>
  [
    alert.title,
    "",
    `Location:  ${alert.location}`,
    ...(alert.sku === null ? [] : [`SKU:       ${alert.sku}`]),
    `Impact:    ${alert.businessImpact}`,
    `Action:    ${alert.recommendedAction}`,
  ].join("\n");

const smsBodyOf = (alert: NotifiableAlert) =>
  `MedCare ${alert.severity.toUpperCase()}: ${alert.title}. ${alert.recommendedAction}`;

/**
 * Routes one alert and records every attempt.
 *
 * Never throws. This runs at the tail of a detection cycle whose rows are already
 * committed; a provider outage must not turn a successful reconciliation into a
 * failed one.
 */
export const routeAlert = async (alert: NotifiableAlert): Promise<Attempt[]> => {
  const attempts: Attempt[] = [];

  try {
    const { notifications } = await getSettings();
    // `getSettings()` widens the rules array, so the shape is named here rather than
    // letting `any` leak into the two gates below.
    const rules = notifications.rules as NotificationRuleRow[];
    const rule = rules.find((entry) => entry.event === alert.type);
    const channels = notifications.channels;

    // In-app is the one channel with no provider and no severity floor: the bell is
    // the review surface, and an alert missing from it cannot be acted on at all.
    if (channels.inApp && (rule?.inApp ?? true)) {
      emitAlert("alert:created", alert, alert.warehouseId);
      attempts.push({ channel: "IN_APP", status: "SENT", recipient: null, error: null });
    } else {
      attempts.push(skipped("IN_APP", "in-app notifications are disabled"));
    }

    const interrupts = meetsSeverityFloor(alert.severity);

    if (!channels.email || !(rule?.email ?? false)) {
      attempts.push(skipped("EMAIL", "email is disabled for this event"));
    } else if (!interrupts) {
      attempts.push(skipped("EMAIL", `severity ${alert.severity} is below ${NOTIFY.minSeverity}`));
    } else if (!emailConfigured()) {
      attempts.push(skipped("EMAIL", "email provider is not configured"));
    } else {
      attempts.push(
        fromSendResult("EMAIL", await sendEmail({ subject: subjectOf(alert), text: bodyOf(alert) })),
      );
    }

    if (!channels.sms || !(rule?.sms ?? false)) {
      attempts.push(skipped("SMS", "sms is disabled for this event"));
    } else if (!interrupts) {
      attempts.push(skipped("SMS", `severity ${alert.severity} is below ${NOTIFY.minSeverity}`));
    } else if (!smsConfigured()) {
      attempts.push(skipped("SMS", "sms provider is not configured"));
    } else {
      for (const result of await sendSms(smsBodyOf(alert))) {
        attempts.push(fromSendResult("SMS", result));
      }
    }
  } catch (error) {
    attempts.push({
      channel: "IN_APP",
      status: "FAILED",
      recipient: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await recordDeliveries(alert.id, attempts);
  return attempts;
};

const recordDeliveries = async (alertId: string, attempts: Attempt[]): Promise<void> => {
  if (attempts.length === 0) return;

  try {
    await prisma.$transaction([
      prisma.notificationDelivery.createMany({
        data: attempts.map((attempt) => ({
          alertId,
          channel: attempt.channel,
          status: attempt.status,
          recipient: attempt.recipient,
          error: attempt.error,
        })),
      }),
      // `notifiedAt` is what stops the next cycle re-sending a condition that is still
      // true. Reconciliation leaves an unchanged alert alone, but a severity change
      // rewrites it, and without this every re-assessment would page someone again.
      prisma.alert.update({ where: { id: alertId }, data: { notifiedAt: new Date() } }),
    ]);
  } catch (error) {
    console.error("could not record notification deliveries", { alertId, error });
  }
};

/**
 * Fans out a batch, bounded.
 *
 * A first detection on an empty database raises one alert per at-risk position -
 * well over a hundred on a full network. Unbounded `Promise.all` would open that many
 * provider connections at once and trip rate limits on both Resend and SNS.
 */
const SEND_CONCURRENCY = 4;

export const routeAlerts = async (alerts: NotifiableAlert[]): Promise<number> => {
  let sent = 0;

  for (let index = 0; index < alerts.length; index += SEND_CONCURRENCY) {
    const batch = alerts.slice(index, index + SEND_CONCURRENCY);
    const results = await Promise.all(batch.map((alert) => routeAlert(alert)));
    sent += results.flat().filter((attempt) => attempt.status === "SENT").length;
  }

  return sent;
};

export const listDeliveries = async (query: DeliveryQuery) => {
  const where = {
    ...(query.alertId === undefined ? {} : { alertId: query.alertId }),
    ...(query.channel === undefined ? {} : { channel: query.channel }),
    ...(query.status === undefined ? {} : { status: query.status }),
  };

  const [total, rows] = await Promise.all([
    prisma.notificationDelivery.count({ where }),
    prisma.notificationDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        alertId: true,
        channel: true,
        status: true,
        recipient: true,
        error: true,
        attempts: true,
        createdAt: true,
        alert: { select: { title: true, severity: true, type: true } },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      alertId: row.alertId,
      channel: row.channel,
      status: row.status,
      recipient: row.recipient,
      error: row.error,
      attempts: row.attempts,
      createdAt: row.createdAt.toISOString(),
      alertTitle: row.alert.title,
      alertSeverity: row.alert.severity,
      alertType: row.alert.type,
    })),
    total,
  };
};

/**
 * A probe on every enabled channel, so channel configuration is verifiable without
 * waiting for a real condition to fire. Sends nothing that is not already switched on.
 */
export const sendTestNotification = async () => {
  const { notifications } = await getSettings();
  const results: Attempt[] = [];

  if (notifications.channels.inApp) {
    emitAlert("alert:updated", { test: true, message: "Test notification" }, null);
    results.push({ channel: "IN_APP", status: "SENT", recipient: null, error: null });
  } else {
    results.push(skipped("IN_APP", "in-app notifications are disabled"));
  }

  if (!notifications.channels.email) {
    results.push(skipped("EMAIL", "email is disabled"));
  } else if (!emailConfigured()) {
    results.push(skipped("EMAIL", "email provider is not configured"));
  } else {
    results.push(
      fromSendResult(
        "EMAIL",
        await sendEmail({
          subject: "MedCare SCM test notification",
          text: "Email delivery is configured correctly. No action is required.",
        }),
      ),
    );
  }

  if (!notifications.channels.sms) {
    results.push(skipped("SMS", "sms is disabled"));
  } else if (!smsConfigured()) {
    results.push(skipped("SMS", "sms provider is not configured"));
  } else {
    for (const result of await sendSms("MedCare SCM test notification. No action required.")) {
      results.push(fromSendResult("SMS", result));
    }
  }

  return { results };
};
