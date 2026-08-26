import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

const CHUNK = 1_000;

const chunked = async <T>(rows: T[], write: (batch: T[]) => Promise<unknown>): Promise<number> => {
  for (let index = 0; index < rows.length; index += CHUNK) {
    await write(rows.slice(index, index + CHUNK));
  }
  return rows.length;
};

/**
 * Bulk artefact writes, outside any transaction.
 *
 * 10,000 inserts in one interactive transaction would hold locks for the whole run
 * and blow past Prisma's transaction timeout. A run is only real once its status is
 * COMPLETED, so artefacts belonging to a run that never completes are unreachable by
 * contract - which is what makes writing them loosely safe.
 */
export const writeForecasts = (rows: Prisma.ForecastCreateManyInput[]) =>
  chunked(rows, (data) => prisma.forecast.createMany({ data }));

export const writeInventoryPlans = (rows: Prisma.InventoryPlanCreateManyInput[]) =>
  chunked(rows, (data) => prisma.inventoryPlan.createMany({ data }));

export const writeSupplyPlans = (rows: Prisma.SupplyPlanCreateManyInput[]) =>
  chunked(rows, (data) => prisma.supplyPlan.createMany({ data }));

export const writeDrpPlans = (rows: Prisma.DRPPlanCreateManyInput[]) =>
  chunked(rows, (data) => prisma.dRPPlan.createMany({ data }));

/**
 * Everything a re-run must clear first, so executing the same run twice converges
 * instead of duplicating. Ordered child-first; none of these are referenced by
 * anything else, so a plain sequence is enough.
 */
export const clearRunArtifacts = async (planningRunId: string): Promise<void> => {
  await prisma.recommendation.deleteMany({ where: { planningRunId } });
  await prisma.dRPPlan.deleteMany({ where: { planningRunId } });
  await prisma.supplyPlan.deleteMany({ where: { planningRunId } });
  await prisma.inventoryPlan.deleteMany({ where: { planningRunId } });
  await prisma.forecast.deleteMany({ where: { planningRunId } });
  await prisma.optimizationResult.deleteMany({ where: { planningRunId } });
  await prisma.simulationRun.deleteMany({ where: { planningRunId } });
};

export interface SignalDraft {
  type: "Demand" | "Inventory" | "LeadTime" | "Expiry" | "Risk";
  label: string;
  direction: "up" | "down" | "flat";
}

export type RecommendationDraft = Prisma.RecommendationCreateManyInput & {
  signals: SignalDraft[];
};

export interface RunCompletion {
  planningRunId: string;
  modelVersion: string;
  optimization: Omit<Prisma.OptimizationResultCreateManyInput, "planningRunId">;
  simulation: Omit<Prisma.SimulationRunCreateManyInput, "planningRunId">;
  recommendations: RecommendationDraft[];
}

/**
 * The one short transaction: the two single-row summaries, the recommendations, and
 * the status flip that makes the whole run visible. Either a run is COMPLETED with
 * its headline numbers, or it is not COMPLETED at all.
 */
export const completeRun = async (completion: RunCompletion): Promise<void> => {
  const { planningRunId, modelVersion, optimization, simulation, recommendations } = completion;

  // The id is assigned here rather than left to the database default so the signals
  // can be attached without having to find their recommendation again afterwards.
  // There is no natural key to find it by: the day loop can raise a dozen transfers
  // into the same product and warehouse across the horizon, and their messages are
  // identical, so (productId, warehouseId, type) and every variation on it collide.
  const identified = recommendations.map((row) => ({ ...row, id: randomUUID() }));

  await prisma.$transaction([
    prisma.optimizationResult.create({ data: { planningRunId, ...optimization } }),
    prisma.simulationRun.create({ data: { planningRunId, ...simulation } }),
    prisma.recommendation.createMany({
      data: identified.map(({ signals: _signals, ...row }) => row),
    }),
    prisma.planningRun.update({
      where: { id: planningRunId },
      // progress 100 lands with the status, so a client polling mid-flight can never
      // see a finished-looking run that is still working.
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        modelVersion,
        currentStage: "complete",
        progress: 100,
      },
    }),
  ]);

  // Swallowed on purpose: the run is COMPLETED as of the transaction above, and the
  // executor's own catch would flip that row to FAILED over a secondary write.
  try {
    await writeRecommendationSignals(identified);
  } catch (error) {
    console.error("attaching recommendation signals failed", { planningRunId, error });
  }
};

/**
 * Attaches each recommendation's signals, after the run is COMPLETED rather than
 * inside its transaction.
 *
 * Nesting the signals under 200 individual `create` calls would replace one batched
 * insert with roughly eight hundred statements and overrun the transaction budget, so
 * they go in as their own batches against the ids assigned above.
 *
 * A failure here leaves a COMPLETED run whose recommendations carry no signals, which
 * is what the surface showed before any of them existed - strictly better than rolling
 * back a run that is otherwise correct.
 */
const writeRecommendationSignals = async (
  recommendations: (RecommendationDraft & { id: string })[],
): Promise<void> => {
  const rows = recommendations.flatMap((row) =>
    row.signals.map((signal) => ({ recommendationId: row.id, ...signal })),
  );

  await chunked(rows, (data) => prisma.recommendationSignal.createMany({ data }));
};
