import { NOTIFY } from "../config/constants.js";
import type { SendResult } from "./mailer.js";

/**
 * Delivery to a Microsoft Teams channel over an incoming webhook.
 *
 * A webhook URL is the whole credential - it identifies the channel and authorises
 * the post - so there is nothing to sign and no SDK worth carrying. One POST, same
 * shape as the mailer.
 *
 * Teams renders a bare `{ text }` payload as plain text and a `MessageCard` with
 * sections as a formatted card. The card is worth the extra few lines: an alert with
 * its impact and recommended action on separate rows is scannable in a channel, and a
 * wall of concatenated text is not.
 *
 * Nothing here throws. An unset webhook, a revoked one and a Teams outage are all
 * outcomes recorded against the alert.
 */

export const teamsConfigured = (): boolean => NOTIFY.teams.webhookUrl !== undefined;

const describe = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `no response within ${NOTIFY.timeoutMs}ms`;
  }
  return error instanceof Error ? error.message : String(error);
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "D13438",
  high: "F7630C",
  medium: "FFB900",
  low: "8A8886",
};

export interface TeamsMessage {
  title: string;
  severity: string;
  facts: { name: string; value: string }[];
  text: string;
}

export const sendTeams = async (message: TeamsMessage): Promise<SendResult> => {
  if (!teamsConfigured()) {
    return { status: "SKIPPED", recipient: null, reason: "teams webhook is not configured" };
  }

  // The channel behind the webhook; the URL itself is a credential and must not be
  // recorded as the recipient.
  const recipient = "teams channel";

  try {
    const response = await fetch(NOTIFY.teams.webhookUrl!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        themeColor: SEVERITY_COLOR[message.severity] ?? SEVERITY_COLOR.low,
        summary: message.title,
        title: `[${message.severity.toUpperCase()}] ${message.title}`,
        sections: [{ facts: message.facts, text: message.text }],
      }),
      signal: AbortSignal.timeout(NOTIFY.timeoutMs),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        status: "FAILED",
        recipient,
        error: `teams responded ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      };
    }

    // A revoked or malformed webhook answers 200 with a body saying so, rather than
    // an error status - so the body has to be read to know whether it landed.
    const body = await response.text().catch(() => "");
    if (body && body !== "1" && body.toLowerCase().includes("error")) {
      return { status: "FAILED", recipient, error: `teams rejected the card: ${body.slice(0, 300)}` };
    }

    return { status: "SENT", recipient };
  } catch (error) {
    return { status: "FAILED", recipient, error: describe(error) };
  }
};
