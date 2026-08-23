import { PrismaPg } from "@prisma/adapter-pg";
import { DATABASE_URL } from "./constants.js";
import { PrismaClient } from "../generated/prisma/client.js";

export const prisma = new PrismaClient(
  DATABASE_URL.startsWith("prisma+postgres://")
    ? { accelerateUrl: DATABASE_URL }
    : { adapter: new PrismaPg({ connectionString: DATABASE_URL }) },
);

export const isDatabaseHealthy = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("database health check failed", error);
    return false;
  }
};

export const disconnectPrisma = (): Promise<void> => prisma.$disconnect();
