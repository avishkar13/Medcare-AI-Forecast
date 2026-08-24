process.env.RATE_LIMIT_ENABLED ??= "false";

const [{ app }, { disconnectPrisma }, { disconnectRedis }] = await Promise.all([
  import("../../src/app.js"),
  import("../../src/config/prisma.js"),
  import("../../src/config/redis.js"),
]);

export const teardown = async (): Promise<void> => {
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
};

export { app };
