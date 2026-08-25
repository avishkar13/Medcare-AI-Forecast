process.env.RATE_LIMIT_ENABLED ??= "false";
// Suites that assert a freshly created run is still PENDING would otherwise race the
// executor. The execution suites opt back in explicitly.
process.env.PLANNING_EXECUTOR ??= "disabled";

const [{ app }, { disconnectPrisma }, { disconnectRedis }] = await Promise.all([
  import("../../src/app.js"),
  import("../../src/config/prisma.js"),
  import("../../src/config/redis.js"),
]);

export const teardown = async (): Promise<void> => {
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
};

export { app };
