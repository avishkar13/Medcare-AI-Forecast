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

export interface RunCompletion {
  planningRunId: string;
  modelVersion: string;
  optimization: Omit<Prisma.OptimizationResultCreateManyInput, "planningRunId">;
  simulation: Omit<Prisma.SimulationRunCreateManyInput, "planningRunId">;
  recommendations: Prisma.RecommendationCreateManyInput[];
}

/**
 * The one short transaction: the two single-row summaries, the recommendations, and
 * the status flip that makes the whole run visible. Either a run is COMPLETED with
 * its headline numbers, or it is not COMPLETED at all.
 */
export const completeRun = async (completion: RunCompletion): Promise<void> => {
  const { planningRunId, modelVersion, optimization, simulation, recommendations } = completion;

  await prisma.$transaction([
    prisma.optimizationResult.create({ data: { planningRunId, ...optimization } }),
    prisma.simulationRun.create({ data: { planningRunId, ...simulation } }),
    prisma.recommendation.createMany({ data: recommendations }),
    prisma.planningRun.update({
      where: { id: planningRunId },
      data: { status: "COMPLETED", completedAt: new Date(), modelVersion },
    }),
  ]);
};
