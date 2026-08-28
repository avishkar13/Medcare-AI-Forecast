process.env.RATE_LIMIT_ENABLED ??= "false";
// Suites that assert a freshly created run is still PENDING would otherwise race the
// executor. The execution suites opt back in explicitly.
process.env.PLANNING_EXECUTOR ??= "disabled";

/**
 * The integration suites are destructive by design: they create fixtures, they call
 * `redis.flushdb()`, and their teardowns delete rows. Two of those teardowns filter on
 * `product?.id`, and Prisma reads `undefined` as "no filter" - so a suite whose `before`
 * throws will delete *every* row in the tables it was only meant to clean up after
 * itself. That is not hypothetical: it emptied DemandHistory, Inventory and Alert on
 * the shared Neon database once already.
 *
 * The real fix is guarded teardowns, and those should still be written. This is the
 * cheaper half: whatever any individual suite does, it can only do it locally.
 *
 * Every integration suite imports this module for `app`, so one check covers all of
 * them, and it runs before `src/app.js` is imported - i.e. before any pool is opened.
 */
const assertLocalOnly = (name: string, value: string | undefined): void => {
  if (!value) return;

  const isLocal = /(?:@|\/\/)(?:localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/.test(
    value,
  );
  if (isLocal) return;

  // The host is redacted rather than printed: this message reaches CI logs.
  const host = value.replace(/^([a-z+]+:\/\/)(?:[^@]*@)?([^/?:]*).*$/i, "$2");
  throw new Error(
    `refusing to run integration tests against a non-local ${name} (${host}). ` +
      `These suites flush Redis and delete rows. Point ${name} at the docker compose ` +
      `service first, e.g. ${name}=${
        name === "DATABASE_URL"
          ? "postgresql://cognizant:cognizant_secret@localhost:5432/cognizant"
          : "redis://:cognizant_redis@localhost:6379"
      }`,
  );
};

assertLocalOnly("DATABASE_URL", process.env.DATABASE_URL);
assertLocalOnly("REDIS_URL", process.env.REDIS_URL);

const [{ app }, { disconnectPrisma }, { disconnectRedis }] = await Promise.all([
  import("../../src/app.js"),
  import("../../src/config/prisma.js"),
  import("../../src/config/redis.js"),
]);

export const teardown = async (): Promise<void> => {
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
};

export { app };
