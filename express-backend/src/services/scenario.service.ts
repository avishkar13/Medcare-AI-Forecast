import { prisma } from "../config/prisma.js";
import { resolveActorId } from "../lib/actor.js";
import { NotFoundError } from "../utils/errors.js";
import type {
  CreateScenarioBody,
  ScenarioParams,
  ScenarioQuery,
} from "../zod/scenario.schemas.js";
import type { ScenarioSummary } from "../types.js";

interface ScenarioRow {
  id: string;
  name: string;
  description: string | null;
  demandMultiplier: number;
  leadTimeMultiplier: number;
  capacityMultiplier: number;
  serviceLevelTarget: number;
  createdById: string;
  createdAt: Date;
  _count: { planningRuns: number };
}

const scenarioSelect = {
  id: true,
  name: true,
  description: true,
  demandMultiplier: true,
  leadTimeMultiplier: true,
  capacityMultiplier: true,
  serviceLevelTarget: true,
  createdById: true,
  createdAt: true,
  _count: { select: { planningRuns: true } },
};

const toSummary = (row: ScenarioRow): ScenarioSummary => ({
  id: row.id,
  name: row.name,
  description: row.description,
  demandMultiplier: row.demandMultiplier,
  leadTimeMultiplier: row.leadTimeMultiplier,
  capacityMultiplier: row.capacityMultiplier,
  serviceLevelTarget: row.serviceLevelTarget,
  createdById: row.createdById,
  createdAt: row.createdAt.toISOString(),
  // How many runs have been executed under this scenario. A scenario with none has
  // never been tested; one with several is safe to compare against.
  planningRunCount: row._count.planningRuns,
});

export const createScenario = async (body: CreateScenarioBody): Promise<ScenarioSummary> => {
  const row = await prisma.scenario.create({
    data: {
      name: body.name,
      ...(body.description === undefined ? {} : { description: body.description }),
      demandMultiplier: body.demandMultiplier,
      leadTimeMultiplier: body.leadTimeMultiplier,
      capacityMultiplier: body.capacityMultiplier,
      serviceLevelTarget: body.serviceLevelTarget,
      createdById: await resolveActorId(),
    },
    select: scenarioSelect,
  });

  return toSummary(row);
};

export const listScenarios = async (
  query: ScenarioQuery,
): Promise<{ items: ScenarioSummary[]; total: number }> => {
  const where =
    query.search === undefined
      ? {}
      : { name: { contains: query.search, mode: "insensitive" as const } };

  const [total, rows] = await Promise.all([
    prisma.scenario.count({ where }),
    prisma.scenario.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: scenarioSelect,
    }),
  ]);

  return { items: rows.map(toSummary), total };
};

export const getScenario = async ({ id }: ScenarioParams): Promise<ScenarioSummary> => {
  const row = await prisma.scenario.findUnique({ where: { id }, select: scenarioSelect });
  if (!row) throw new NotFoundError(`Scenario '${id}' not found`);
  return toSummary(row);
};
