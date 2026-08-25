import { PLANNING } from "../config/constants.js";
import { prisma } from "../config/prisma.js";
import { ServiceUnavailableError } from "../utils/errors.js";

/**
 * Who owns a record that a user did not explicitly create.
 *
 * There is no authentication yet, so rows that need a `createdById` get the seeded
 * SYSTEM user. WP-16 replaces this with the authenticated caller; until then this is
 * the single place that decides, so there is one thing to change rather than several.
 */
export const resolveActorId = async (): Promise<string> => {
  const system = await prisma.user.findUnique({
    where: { email: PLANNING.systemUserEmail },
    select: { id: true },
  });
  if (system) return system.id;

  const fallback = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (fallback) return fallback.id;

  throw new ServiceUnavailableError(
    "No user exists to own this record; seed the database before creating one",
  );
};
