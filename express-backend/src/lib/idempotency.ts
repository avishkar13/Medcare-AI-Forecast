import { redis } from "../config/redis.js";
import { redisKeys } from "../config/redis-keys.js";

const IN_FLIGHT = "in-flight";

export type Reservation =
  | { kind: "disabled" }
  | { kind: "reserved" }
  | { kind: "in-flight" }
  | { kind: "replay"; value: string };

export const reserve = async (key: string, ttlMs: number): Promise<Reservation> => {
  const client = redis;
  if (!client) return { kind: "disabled" };

  const redisKey = redisKeys.idempotency(key);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if ((await client.set(redisKey, IN_FLIGHT, "PX", ttlMs, "NX")) === "OK") return { kind: "reserved" };

    const stored = await client.get(redisKey);
    if (stored === IN_FLIGHT) return { kind: "in-flight" };
    if (stored !== null) return { kind: "replay", value: stored };
  }

  return { kind: "reserved" };
};

export const complete = async (key: string, value: string, ttlMs: number): Promise<void> => {
  await redis?.set(redisKeys.idempotency(key), value, "PX", ttlMs);
};

export const abandon = async (key: string): Promise<void> => {
  await redis?.del(redisKeys.idempotency(key));
};
