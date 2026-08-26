import { PLANNING } from "../config/constants.js";
import { prisma } from "../config/prisma.js";

/**
 * Artefact retention.
 *
 * A run writes roughly 10,000 rows. Running daily, a month is ~300,000 - so this
 * stops being theoretical the moment anyone schedules the planner.
 *
 * **What is pruned, and what is kept, is the whole design here.**
 *
 * Pruned: `InventoryPlan`, `SupplyPlan`, `DRPPlan`, `Recommendation`. These are the
 * *plan* - what to do next - and a newer run supersedes them entirely. Nobody acts
 * on last month's proposed transfers.
 *
 * Kept, permanently: the `PlanningRun` row, its `Forecast` rows, its
 * `OptimizationResult` and its `SimulationRun`.
 *
 * - The run row is the history: what was run, when, under which scenario.
 * - `OptimizationResult` and `SimulationRun` are one row each, and they are what
 *   `/compare` reads. Pruning them would silently break comparison against any
 *   older run.
 * - **`Forecast` is the evidence base for accuracy.** WP-19 scores past forecasts
 *   against realised demand, and the whole point of keeping several vintages is to
 *   measure error at each horizon across many origins. Deleting old forecasts would
 *   destroy exactly the record that makes accuracy measurable over time.
 *
 * Forecast rows are the bulk of a run (4,800 of ~10,000), so keeping them limits how
 * much this reclaims. That is the right trade: plans are disposable, measurements are
 * not. If forecast volume ever becomes the problem, the answer is a rollup table of
 * per-horizon errors, not deleting the rows they are computed from.
 */

export interface PruneOutcome {
  keptRuns: number;
  prunedRuns: number;
  deleted: {
    inventoryPlans: number;
    supplyPlans: number;
    drpPlans: number;
    recommendations: number;
  };
}

const EMPTY: PruneOutcome["deleted"] = {
  inventoryPlans: 0,
  supplyPlans: 0,
  drpPlans: 0,
  recommendations: 0,
};

/**
 * Prunes plan artefacts from all but the `keep` most recent completed runs.
 *
 * Only `COMPLETED` runs are counted toward `keep`: a failed run's partial artefacts
 * are unreachable by contract, so they are pruned as soon as they fall outside the
 * window rather than occupying a slot a usable run could have.
 */
export const pruneOldRunArtifacts = async (
  keep: number = PLANNING.retentionRuns,
): Promise<PruneOutcome> => {
  if (keep <= 0) return { keptRuns: 0, prunedRuns: 0, deleted: { ...EMPTY } };

  const keepIds = (
    await prisma.planningRun.findMany({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: keep,
      select: { id: true },
    })
  ).map((row) => row.id);

  // Runs whose plans are already gone are matched again on every sweep, which is
  // harmless: deleteMany over an empty set is one cheap statement.
  const stale = await prisma.planningRun.findMany({
    where: { id: { notIn: keepIds } },
    select: { id: true },
  });

  if (stale.length === 0) {
    return { keptRuns: keepIds.length, prunedRuns: 0, deleted: { ...EMPTY } };
  }

  const ids = stale.map((row) => row.id);
  const where = { planningRunId: { in: ids } };

  // Sequential rather than one transaction: this is background housekeeping, and a
  // partial prune is harmless - the next sweep finishes it. Holding a transaction
  // over several hundred thousand deletes would block writes that matter more.
  const recommendations = await prisma.recommendation.deleteMany({ where });
  const drpPlans = await prisma.dRPPlan.deleteMany({ where });
  const supplyPlans = await prisma.supplyPlan.deleteMany({ where });
  const inventoryPlans = await prisma.inventoryPlan.deleteMany({ where });

  return {
    keptRuns: keepIds.length,
    prunedRuns: ids.length,
    deleted: {
      inventoryPlans: inventoryPlans.count,
      supplyPlans: supplyPlans.count,
      drpPlans: drpPlans.count,
      recommendations: recommendations.count,
    },
  };
};
