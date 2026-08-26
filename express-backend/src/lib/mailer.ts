import { NOTIFY } from "../config/constants.js";

/**
 * Email delivery over Resend's REST API.
 *
 * Called over `fetch` rather than the SDK: one POST with a bearer token is the whole
 * contract, and the SDK would be a dependency carried for a single call.
 *
 * Nothing here throws. A missing credential, a provider outage and a rejected address
 * are all outcomes the caller records against the alert, not faults that should abort
 * a detection cycle that has already committed its rows.
 */

const ENDPOINT = "https://api.resend.com/emails";

export type SendResult =
  | { status: "SENT"; recipient: string }
  | { status: "SKIPPED"; recipient: string | null; reason: string }
  | { status: "FAILED"; recipient: string | null; error: string };

export const emailConfigured = (): boolean =>
  NOTIFY.email.apiKey !== undefined &&
  NOTIFY.email.from !== undefined &&
  NOTIFY.email.recipients.length > 0;

const describe = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `no response within ${NOTIFY.timeoutMs}ms`;
  }
  return error instanceof Error ? error.message : String(error);
};

export interface EmailMessage {
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (message: EmailMessage): Promise<SendResult> => {
  if (!emailConfigured()) {
    return {
      status: "SKIPPED",
      recipient: NOTIFY.email.recipients[0] ?? null,
      reason: "email provider is not configured",
    };
  }

  const recipient = NOTIFY.email.recipients.join(", ");

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${NOTIFY.email.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY.email.from,
        to: NOTIFY.email.recipients,
        subject: message.subject,
        text: message.text,
        ...(message.html === undefined ? {} : { html: message.html }),
      }),
      signal: AbortSignal.timeout(NOTIFY.timeoutMs),
    });

    if (!response.ok) {
      // The body carries the actual reason - an unverified sending domain reads as a
      // bare 403 otherwise, which is the single most common way this fails in practice.
      const detail = await response.text().catch(() => "");
      return {
        status: "FAILED",
        recipient,
        error: `resend responded ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      };
    }

    return { status: "SENT", recipient };
  } catch (error) {
    return { status: "FAILED", recipient, error: describe(error) };
  }
};
