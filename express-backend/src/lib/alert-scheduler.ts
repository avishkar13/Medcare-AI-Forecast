import { NOTIFY } from "../config/constants.js";
import { acquireLock } from "./redis-lock.js";
import { refreshAlerts } from "../services/alert-detector.service.js";

/**
 * Keeps detection running without a planning run.
 *
 * Detection used to be reachable from exactly one place - the tail of the executor -
 * and the route that starts a run had no caller in the UI. A fresh database therefore
 * held no alerts and had no way to acquire any, which left the bell, the alerts page
 * and the dashboard's alert counts permanently empty. This is the other trigger.
 *
 * A cycle is a whole-table reconciliation, so overlapping cycles would duplicate the
 * work and race on the same rows. The lock is what makes several instances safe:
 * whichever one holds it runs, the rest skip that tick and try again on the next.
 */

const LOCK_NAME = "alert-detection";

// Long enough that a slow cycle keeps its claim, short enough that a killed process
// does not block detection for long. A cycle over a full network is seconds.
const LOCK_TTL_MS = 120_000;

let timer: NodeJS.Timeout | null = null;
let running: Promise<void> | null = null;

const cycle = async (): Promise<void> => {
  const lock = await acquireLock(LOCK_NAME, LOCK_TTL_MS);
  if (!lock) return;

  try {
    const outcome = await refreshAlerts();
    if (outcome.skipped) return;
    if (outcome.created > 0 || outcome.resolved > 0) {
      console.log("alert detection", outcome);
    }
  } catch (error) {
    // Detection is idempotent, so a failed cycle costs nothing the next one cannot
    // repair. Logged rather than rethrown: an unhandled rejection here would take the
    // process down through the handler in index.ts.
    console.error("alert detection cycle failed", error);
  } finally {
    await lock.release();
  }
};

const tick = (): void => {
  if (running) return;
  running = cycle().finally(() => {
    running = null;
  });
};

export const startAlertScheduler = (): void => {
  if (NOTIFY.detectionIntervalMs === 0 || timer) return;

  // `unref` so the interval alone never holds the process open.
  timer = setInterval(tick, NOTIFY.detectionIntervalMs).unref();

  // An interval fires first after one full period. Without this a fresh boot shows an
  // empty table for the whole of that period, which is the exact failure being fixed.
  setTimeout(tick, 5_000).unref();

  console.log("alert detection scheduled", { intervalMs: NOTIFY.detectionIntervalMs });
};

/** Lets an in-progress cycle finish during shutdown rather than tearing Prisma out from under it. */
export const stopAlertScheduler = async (timeoutMs: number): Promise<void> => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (!running) return;

  await Promise.race([
    running,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs).unref()),
  ]);
};
