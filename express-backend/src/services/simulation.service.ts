import { prisma } from "../config/prisma.js";
import { createRun } from "./planning.service.js";
import { loadPositions } from "./dashboard.service.js";
import { resolveActorId } from "../lib/actor.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { round } from "../utils/inventory.js";
import type {
  SaveScenarioBody,
  SimulationParams,
  WhatIfBody,
} from "../zod/simulation.schemas.js";

/**
 * What-if simulation.
 *
 * A simulation here is a real planning run under a scenario, not a formula over the
 * request body. The route this replaces computed `15.2 + demandShock * 0.3` and
 * returned it as a stockout risk beside a hardcoded SKU and DC - numbers that moved
 * when you changed the input, which made them look derived from something.
 *
 * Running is asynchronous, so this returns the run to poll. The results come from
 * `GET /api/planning/runs/:id` and `.../compare`, which read what the executor wrote.
 */

/**
 * A lead time delta in days only means something against a base. That base is the
 * network's demand-weighted average lead time, read from the positions rather than
 * assumed, so no caller has to carry a nominal figure of its own.
 */
export const averageLeadTimeDays = async () => {
  const positions = await loadPositions();
  if (positions.length === 0) return 0;
  return round(
    positions.reduce((total, position) => total + position.leadTimeDays, 0) / positions.length,
    2,
  );
};

const resolveLeadTimePercent = async (params: SimulationParams) => {
  if (params.leadTimeChangeDays === undefined) return params.leadTimeChangePercent;
  const base = await averageLeadTimeDays();
  return base === 0 ? 0 : round((params.leadTimeChangeDays / base) * 100, 2);
};

/** UI-facing percentages -> the multipliers a Scenario stores. */
const toMultipliers = (params: SimulationParams, leadTimeChangePercent: number) => ({
  demandMultiplier: round(1 + params.demandShockPercent / 100, 4),
  leadTimeMultiplier: round(1 + leadTimeChangePercent / 100, 4),
  capacityMultiplier: round(1 + params.capacityChangePercent / 100, 4),
  serviceLevelTarget: round(params.serviceLevelTargetPercent / 100, 4),
});

/** And back again, so a saved scenario round-trips to the form that made it. */
const toParams = (scenario: {
  demandMultiplier: number;
  leadTimeMultiplier: number;
  capacityMultiplier: number;
  serviceLevelTarget: number;
}): SimulationParams => ({
  demandShockPercent: round((scenario.demandMultiplier - 1) * 100),
  leadTimeChangePercent: round((scenario.leadTimeMultiplier - 1) * 100),
  capacityChangePercent: round((scenario.capacityMultiplier - 1) * 100),
  serviceLevelTargetPercent: round(scenario.serviceLevelTarget * 100),
});

const scenarioSelect = {
  id: true,
  name: true,
  description: true,
  demandMultiplier: true,
  leadTimeMultiplier: true,
  capacityMultiplier: true,
  serviceLevelTarget: true,
  riskLevel: true,
  createdAt: true,
  _count: { select: { planningRuns: true } },
};

const toScenario = (row: {
  id: string;
  name: string;
  description: string | null;
  demandMultiplier: number;
  leadTimeMultiplier: number;
  capacityMultiplier: number;
  serviceLevelTarget: number;
  riskLevel: string | null;
  createdAt: Date;
  _count: { planningRuns: number };
}) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  riskLevel: row.riskLevel,
  params: toParams(row),
  multipliers: {
    demandMultiplier: row.demandMultiplier,
    leadTimeMultiplier: row.leadTimeMultiplier,
    capacityMultiplier: row.capacityMultiplier,
    serviceLevelTarget: row.serviceLevelTarget,
  },
  planningRunCount: row._count.planningRuns,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Creates the scenario, starts a run under it, and hands back the run to poll.
 *
 * `createRun` is reused rather than inserting a PlanningRun directly, so the
 * single-active-run guard, the idempotency path and the executor scheduling all
 * apply exactly as they do to a normal run.
 */
export const runWhatIf = async (body: WhatIfBody, actorId?: string) => {
  const scenario = await prisma.scenario.create({
    data: {
      name: body.name,
      ...(body.description === undefined ? {} : { description: body.description }),
      ...toMultipliers(body.params, await resolveLeadTimePercent(body.params)),
      createdById: await resolveActorId(actorId),
    },
    select: scenarioSelect,
  });

  const { run } = await createRun(
    { horizonDays: body.horizonDays, scenarioId: scenario.id },
    undefined,
    actorId,
  );

  return {
    scenario: toScenario(scenario),
    run,
    // Said plainly, because the route this replaces returned finished-looking
    // numbers immediately and there was nothing to wait for.
    pollAt: `/api/planning/runs/${run.id}`,
    compareAt: `/api/planning/runs/${run.id}/compare?baseline=<runId>`,
  };
};

/** Scenarios that have actually been run, newest first. */
export const listHistory = async (limit: number) => {
  const rows = await prisma.scenario.findMany({
    where: { planningRuns: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      ...scenarioSelect,
      planningRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, completedAt: true, horizonDays: true },
      },
    },
  });

  return rows.map((row) => ({
    ...toScenario(row),
    latestRun: row.planningRuns[0]
      ? {
          id: row.planningRuns[0].id,
          status: row.planningRuns[0].status,
          horizonDays: row.planningRuns[0].horizonDays,
          completedAt: row.planningRuns[0].completedAt?.toISOString() ?? null,
        }
      : null,
  }));
};

/** Scenarios saved but never run - the presets a planner set up for later. */
export const listSaved = async (limit: number) => {
  const rows = await prisma.scenario.findMany({
    where: { planningRuns: { none: {} } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: scenarioSelect,
  });

  return rows.map(toScenario);
};

export const saveScenario = async (body: SaveScenarioBody, actorId?: string) => {
  const row = await prisma.scenario.create({
    data: {
      name: body.name,
      ...(body.description === undefined ? {} : { description: body.description }),
      ...toMultipliers(body.params, await resolveLeadTimePercent(body.params)),
      createdById: await resolveActorId(actorId),
    },
    select: scenarioSelect,
  });

  return toScenario(row);
};

export const deleteScenario = async (id: string) => {
  const existing = await prisma.scenario.findUnique({
    where: { id },
    select: { id: true, _count: { select: { planningRuns: true } } },
  });
  if (!existing) throw new NotFoundError(`Scenario '${id}' not found`);

  // A scenario a run points at cannot be deleted without orphaning that run's
  // provenance - the run would no longer be able to say what it was modelling.
  // Prisma would raise a foreign-key error; this says why.
  if (existing._count.planningRuns > 0) {
    throw new ConflictError(
      `Scenario '${id}' has ${existing._count.planningRuns} planning run(s) and cannot be deleted`,
      { id, planningRunCount: existing._count.planningRuns },
    );
  }

  await prisma.scenario.delete({ where: { id } });
};
