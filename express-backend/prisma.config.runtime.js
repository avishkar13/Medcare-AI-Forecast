// Runtime-only Prisma config for the container image, where the TypeScript
// config and its dev-only imports are unavailable. Prisma 7 reads the
// connection URL from here, so `prisma migrate deploy` needs it in the image.
export default {
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
};
