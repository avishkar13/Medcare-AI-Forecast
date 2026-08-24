import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const url = process.env["DATABASE_URL"];
if (!url) {
  process.stderr.write("DATABASE_URL is not set\n");
  process.exit(1);
}

const prisma = new PrismaClient(
  url.startsWith("prisma+postgres://") ? { accelerateUrl: url } : { adapter: new PrismaPg({ connectionString: url }) },
);

try {
  process.stdout.write(`${await prisma.product.count()}`);
} catch (error) {
  process.stderr.write(`product count failed: ${String(error)}\n`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
