import { PLANNING } from "../config/constants.js";
import { prisma } from "../config/prisma.js";
import { ServiceUnavailableError } from "../utils/errors.js";

/**
 * Who owns a record when nobody is authenticated yet.
 *
 * `actedById` and `createdById` are foreign keys to `User`, so they cannot be a
 * made-up string - the insert would fail. Until auth lands, writes are attributed to
 * the seeded SYSTEM user, and this is the single place that decides.
 */

// One lookup per process. The row never changes and every write needs it.
let cached: string | null = null;

const lookup = async (): Promise<string> => {
  if (cached) return cached;

  const system = await prisma.user.findUnique({
    where: { email: PLANNING.systemUserEmail },
    select: { id: true },
  });

  const fallback =
    system ?? (await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }));

  if (!fallback) {
    throw new ServiceUnavailableError(
      "No user exists to own this record; seed the database before creating one",
    );
  }

  cached = fallback.id;
  return cached;
};

/** The stand-in actor. Exported so middleware can populate `req.userId`. */
export const fallbackUserId = lookup;

/**
 * Resolves the actor for a write.
 *
 * Pass `req.userId`. When auth is wired up that is the authenticated user and this
 * returns it unchanged; until then it is the stand-in and this returns the same
 * thing. Nothing that calls this needs to change when auth arrives.
 */
export const resolveActorId = async (candidate?: string): Promise<string> => {
  if (!candidate) return lookup();

  // A candidate that is not a real user would fail the foreign key at insert time,
  // with an error that says nothing about why. Checked here instead.
  const exists = await prisma.user.findUnique({ where: { id: candidate }, select: { id: true } });
  return exists ? exists.id : lookup();
};

/** Test seam: forget the memoized id. */
export const resetActorCache = () => {
  cached = null;
};
