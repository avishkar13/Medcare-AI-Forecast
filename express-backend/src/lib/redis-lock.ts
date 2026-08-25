import { randomUUID } from "node:crypto";
import { redis } from "../config/redis.js";
import { redisKeys } from "../config/redis-keys.js";

const RELEASE_IF_OWNED = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export interface Lock {
  release: () => Promise<void>;
}

const unlocked: Lock = { release: async () => {} };

export const acquireLock = async (name: string, ttlMs: number): Promise<Lock | null> => {
  const client = redis;
  if (!client) return unlocked;

  const key = redisKeys.lock(name);
  const token = randomUUID();

  if ((await client.set(key, token, "PX", ttlMs, "NX")) !== "OK") return null;

  return {
    release: async () => {
      try {
        await client.eval(RELEASE_IF_OWNED, 1, key, token);
      } catch (error) {
        console.warn("failed to release lock", { name, error });
      }
    },
  };
};
