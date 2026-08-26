import { PLANNING } from "../config/constants.js";
import { prisma } from "../config/prisma.js";
import { RunStatus } from "../../generated/prisma/enums.js";
import { executeRun } from "../services/planning-executor.service.js";
import { pruneOldRunArtifacts } from "../services/retention.service.js";

/**
 * Scheduling seam between the route and the executor.
 *
 * Runs execute in-process: ~10,000 rows finishing in well under a minute does not
 * need a queue, and `insertRun` already caps concurrency at one active run. If a
 * worker container is ever wanted, this file is the only thing that changes.
 */

const inFlight = new Map<string, Promise<void>>();

const execute = async (runId: string): Promise<void> => {
  try {
    await executeRun(runId);

    // Housekeeping, after the run and never on the request path. A failure here
    // must not mark a completed run as failed, so it is logged and dropped.
    try {
      const pruned = await pruneOldRunArtifacts();
      if (pruned.prunedRuns > 0) console.log("pruned plan artefacts", pruned);
    } catch (error) {
      console.error("artefact pruning failed", error);
    }
  } catch (error) {
    // executeRun records its own failures on the row; anything here escaped that path.
    console.error("planning run threw outside its failure handler", { runId, error });
  } finally {
    inFlight.delete(runId);
  }
};

/**
 * Hands a run to the executor after the response has been flushed. Never throws and
 * never awaits - the caller has already answered 202.
 */
export const scheduleRun = (runId: string): void => {
  if (PLANNING.executor !== "inline") return;
  if (inFlight.has(runId)) return;

  inFlight.set(
    runId,
    new Promise<void>((resolve) => {
      setImmediate(() => void execute(runId).then(resolve));
    }),
  );
};

export const inFlightRuns = (): number => inFlight.size;

/**
 * Waits for scheduled runs during shutdown. Anything still executing when the budget
 * expires is marked FAILED, so a restart never leaves a run stuck at RUNNING waiting
 * for the stale sweep.
 */
export const drainPlanning = async (timeoutMs: number): Promise<void> => {
  if (inFlight.size === 0) return;

  console.log("waiting for planning runs to finish", { runs: inFlight.size, timeoutMs });

  const finished = await Promise.race([
    Promise.allSettled([...inFlight.values()]).then(() => true),
    new Promise<false>((resolve) => setTimeout(resolve, timeoutMs, false).unref()),
  ]);

  if (finished) return;

  const abandoned = [...inFlight.keys()];
  console.error("planning runs did not finish before shutdown", { runIds: abandoned });

  await prisma.planningRun.updateMany({
    where: { id: { in: abandoned }, status: { in: [...PLANNING.activeStatuses] } },
    data: {
      status: RunStatus.FAILED,
      completedAt: new Date(),
      failureReason: "The server shut down before this run finished",
      failureStage: "shutdown",
    },
  });
};
