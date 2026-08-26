import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { NOTIFY } from "../config/constants.js";
import type { SendResult } from "./mailer.js";

/**
 * SMS delivery over AWS SNS.
 *
 * The SDK rather than raw `fetch`, unlike the mailer: SNS requires SigV4 request
 * signing, which is a HMAC chain over a canonical request rather than a bearer token.
 * Hand-rolling it to avoid a dependency would be a hundred lines of crypto to
 * maintain for no gain.
 *
 * Two shapes, because both are legitimate:
 *
 *   - a topic ARN, and SNS fans out to whoever is subscribed. Subscriptions are then
 *     managed in AWS rather than in this repo's environment, which is what you want
 *     once more than one person is on call.
 *   - a list of numbers, published to one at a time. Simpler, and enough for a demo.
 *
 * Nothing here throws. A missing credential, a throttle and a rejected number are all
 * outcomes recorded against the alert, not faults that abort a detection cycle whose
 * rows are already committed.
 *
 * India note: SNS delivery to +91 needs the sender ID and template registered under
 * TRAI's DLT regime, exactly as any other provider does. Until that clears, sends
 * come back as an SNS failure and land here as FAILED with the provider's wording.
 */

export const smsConfigured = (): boolean =>
  NOTIFY.sms.region !== undefined &&
  NOTIFY.sms.accessKeyId !== undefined &&
  NOTIFY.sms.secretAccessKey !== undefined &&
  (NOTIFY.sms.topicArn !== undefined || NOTIFY.sms.recipients.length > 0);

const describe = (error: unknown): string => {
  if (error instanceof Error) {
    // SNS errors carry a `name` that is the API error code; it is the useful half.
    return error.name && error.name !== "Error" ? `${error.name}: ${error.message}` : error.message;
  }
  return String(error);
};

/** Built lazily so an unconfigured deploy never constructs a client it cannot use. */
let client: SNSClient | null = null;

const snsClient = (): SNSClient => {
  client ??= new SNSClient({
    region: NOTIFY.sms.region!,
    credentials: {
      accessKeyId: NOTIFY.sms.accessKeyId!,
      secretAccessKey: NOTIFY.sms.secretAccessKey!,
    },
    requestHandler: { requestTimeout: NOTIFY.timeoutMs },
  });
  return client;
};

/** One segment is 160 GSM-7 characters, and SNS bills per segment. */
const SEGMENT_LIMIT = 320;

const publish = async (
  target: { PhoneNumber: string } | { TopicArn: string },
  body: string,
): Promise<SendResult> => {
  const recipient = "PhoneNumber" in target ? target.PhoneNumber : target.TopicArn;

  try {
    await snsClient().send(
      new PublishCommand({
        ...target,
        Message: body,
        MessageAttributes: {
          // Transactional gets delivery priority over Promotional and is the correct
          // classification for an operational alert.
          "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
          ...(NOTIFY.sms.senderId === undefined
            ? {}
            : {
                "AWS.SNS.SMS.SenderID": {
                  DataType: "String",
                  StringValue: NOTIFY.sms.senderId,
                },
              }),
        },
      }),
    );

    return { status: "SENT", recipient };
  } catch (error) {
    return { status: "FAILED", recipient, error: describe(error) };
  }
};

export const sendSms = async (body: string): Promise<SendResult[]> => {
  if (!smsConfigured()) {
    return [
      {
        status: "SKIPPED",
        recipient: NOTIFY.sms.topicArn ?? NOTIFY.sms.recipients[0] ?? null,
        reason: "sms provider is not configured",
      },
    ];
  }

  const truncated = body.length > SEGMENT_LIMIT ? `${body.slice(0, SEGMENT_LIMIT - 1)}…` : body;

  // A topic is one publish however many people are subscribed, so it wins when set.
  if (NOTIFY.sms.topicArn !== undefined) {
    return [await publish({ TopicArn: NOTIFY.sms.topicArn }, truncated)];
  }

  return Promise.all(
    NOTIFY.sms.recipients.map((number) => publish({ PhoneNumber: number }, truncated)),
  );
};
