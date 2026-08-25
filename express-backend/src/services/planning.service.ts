import { PLANNING } from "../config/constants.js";
import { prisma } from "../config/prisma.js";
import { RunStatus } from "../../generated/prisma/enums.js";
import { abandon, complete, reserve } from "../lib/idempotency.js";
import { acquireLock } from "../lib/redis-lock.js";
import { ConflictError, NotFoundError, ServiceUnavailableError } from "../utils/errors.js";
import type { CreateRunBody, RunParams, RunQuery } from "../zod/planning.schemas.js";
import type {
  PlanningRunCreation,
  PlanningRunDetail,
  PlanningRunSummary,
} from "../types.js";

const RUN_LOCK = "planning-run";

const activeStatuses = [...PLANNING.activeStatuses];

interface RunRow {
  id: string;
  status: RunStatus;
  horizonDays: number;
  modelVersion: string | null;
  createdById: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  scenario: { id: string; name: string } | null;
}

const runSelect = {
  id: true,
  status: true,
  horizonDays: true,
  modelVersion: true,
  createdById: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  scenario: { select: { id: true, name: true } },
};

const isActive = (status: RunStatus): boolean =>
  status === RunStatus.PENDING || status === RunStatus.RUNNING;

const staleBefore = (): Date => new Date(Date.now() - PLANNING.runTimeoutMs);

const durationSeconds = (row: RunRow): number | null => {
  if (!row.startedAt || !row.completedAt) return null;
  return Math.round((row.completedAt.getTime() - row.startedAt.getTime()) / 1000);
};

const toSummary = (row: RunRow): PlanningRunSummary => ({
  id: row.id,
  status: row.status,
  horizonDays: row.horizonDays,
  modelVersion: row.modelVersion,
  scenario: row.scenario,
  createdById: row.createdById,
  createdAt: row.createdAt.toISOString(),
  startedAt: row.startedAt?.toISOString() ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  durationSeconds: durationSeconds(row),
  stale: isActive(row.status) && row.createdAt < staleBefore(),
});

const failAbandonedRuns = (): Promise<{ count: number }> =>
  prisma.planningRun.updateMany({
    where: { status: { in: activeStatuses }, createdAt: { lt: staleBefore() } },
    data: { status: RunStatus.FAILED, completedAt: new Date() },
  });

const resolveActorId = async (): Promise<string> => {
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
    "No user exists to own a planning run; seed the database before creating one",
  );
};

const insertRun = async (body: CreateRunBody): Promise<PlanningRunSummary> => {
  await failAbandonedRuns();

  const active = await prisma.planningRun.findFirst({
    where: { status: { in: activeStatuses } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });

  if (active) {
    throw new ConflictError("A planning run is already active", {
      activeRunId: active.id,
      status: active.status,
    });
  }

  if (body.scenarioId) {
    const scenario = await prisma.scenario.findUnique({
      where: { id: body.scenarioId },
      select: { id: true },
    });
    if (!scenario) throw new NotFoundError(`Scenario '${body.scenarioId}' not found`);
  }

  const row = await prisma.planningRun.create({
    data: {
      horizonDays: body.horizonDays,
      createdById: await resolveActorId(),
      ...(body.scenarioId === undefined ? {} : { scenarioId: body.scenarioId }),
      ...(body.modelVersion === undefined ? {} : { modelVersion: body.modelVersion }),
    },
    select: runSelect,
  });

  return toSummary(row);
};

const createGuardedRun = async (body: CreateRunBody): Promise<PlanningRunSummary> => {
  const lock = await acquireLock(RUN_LOCK, PLANNING.lockTtlMs);
  if (!lock) throw new ConflictError("Another planning run is being created; retry shortly");

  try {
    return await insertRun(body);
  } finally {
    await lock.release();
  }
};

export const createRun = async (
  body: CreateRunBody,
  idempotencyKey?: string,
): Promise<PlanningRunCreation> => {
  if (!idempotencyKey) return { run: await createGuardedRun(body), replayed: false };

  const reservation = await reserve(idempotencyKey, PLANNING.idempotencyTtlMs);

  if (reservation.kind === "in-flight") {
    throw new ConflictError("A request with this Idempotency-Key is still in flight");
  }

  if (reservation.kind === "replay") {
    const row = await prisma.planningRun.findUnique({
      where: { id: reservation.value },
      select: runSelect,
    });
    if (row) return { run: toSummary(row), replayed: true };
    await abandon(idempotencyKey);
  }

  try {
    const run = await createGuardedRun(body);
    await complete(idempotencyKey, run.id, PLANNING.idempotencyTtlMs);
    return { run, replayed: false };
  } catch (error) {
    await abandon(idempotencyKey);
    throw error;
  }
};

export const listRuns = async (
  query: RunQuery,
): Promise<{ items: PlanningRunSummary[]; total: number }> => {
  const where = {
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.scenarioId === undefined ? {} : { scenarioId: query.scenarioId }),
  };

  const [total, rows] = await Promise.all([
    prisma.planningRun.count({ where }),
    prisma.planningRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: runSelect,
    }),
  ]);

  return { items: rows.map(toSummary), total };
};

export const getRun = async ({ id }: RunParams): Promise<PlanningRunDetail> => {
  const row = await prisma.planningRun.findUnique({
    where: { id },
    select: {
      ...runSelect,
      optimization: { select: { id: true } },
      simulation: { select: { id: true } },
      _count: {
        select: {
          forecasts: true,
          inventoryPlans: true,
          supplyPlans: true,
          drpPlans: true,
          recommendations: true,
        },
      },
    },
  });

  if (!row) throw new NotFoundError(`Planning run '${id}' not found`);

  return {
    ...toSummary(row),
    artifacts: {
      forecasts: row._count.forecasts,
      inventoryPlans: row._count.inventoryPlans,
      supplyPlans: row._count.supplyPlans,
      drpPlans: row._count.drpPlans,
      recommendations: row._count.recommendations,
      optimization: row.optimization !== null,
      simulation: row.simulation !== null,
    },
  };
};
