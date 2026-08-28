import { PLANNING } from "../config/constants.js";
import { prisma } from "../config/prisma.js";
import { NotFoundError } from "../utils/errors.js";
import { percentage, round } from "../utils/inventory.js";
import type { RunParams } from "../zod/planning.schemas.js";

/**
 * What actually happened, against what the run said would happen.
 *
 * The planner produced a cost and a service level for every run and nothing ever
 * scored either one, so "did the plan work?" had no answer in the product even though
 * every input for it was already being written. This reads the two ledgers the
 * execution loop keeps - DemandHistory for demand met and missed, StockMovement for
 * stock held, moved and written off - and puts the realised figures beside the
 * planned ones.
 *
 * **Only the elapsed part of the horizon is scored.** A 30-day plan two days old is
 * two days of evidence; treating the remaining 28 as zero demand would report every
 * fresh run as a catastrophic under-delivery.
 */

const MS_PER_DAY = 86_400_000;

const startOfDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY);

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const pairKey = (productId: string, warehouseId: string) => `${productId}:${warehouseId}`;

interface UnitCosts {
  holding: number;
  stockout: number;
  expiry: number;
}

const ZERO_COST: UnitCosts = { holding: 0, stockout: 0, expiry: 0 };

/** Per-unit costs by pair. A pair with no parameter row costs nothing to hold or miss. */
const loadUnitCosts = async (): Promise<Map<string, UnitCosts>> => {
  const rows = await prisma.planningParameter.findMany({
    select: {
      productId: true,
      warehouseId: true,
      holdingCostPerUnit: true,
      stockoutCostPerUnit: true,
      expiryCostPerUnit: true,
    },
  });

  return new Map(
    rows.map((row) => [
      pairKey(row.productId, row.warehouseId),
      {
        holding: row.holdingCostPerUnit,
        stockout: row.stockoutCostPerUnit,
        expiry: row.expiryCostPerUnit,
      },
    ]),
  );
};

interface LedgerRow {
  productId: string;
  warehouseId: string;
  date: Date;
  stockAfter: number;
}

/**
 * Closing stock per pair per day, reconstructed from the ledger.
 *
 * No daily inventory snapshot exists, so the last movement of a day carries that day's
 * close - stockAfter is written on every row precisely so this holds. A day with no
 * movement inherits the previous close, which is why the carry is kept rather than the
 * days being summed independently.
 */
const holdingUnitDays = (rows: LedgerRow[], from: Date, to: Date): Map<string, number> => {
  const closes = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const key = pairKey(row.productId, row.warehouseId);
    const byDay = closes.get(key) ?? new Map<string, number>();
    // Rows arrive oldest first, so the last write for a day is that day's close.
    byDay.set(isoDay(row.date), row.stockAfter);
    closes.set(key, byDay);
  }

  const unitDays = new Map<string, number>();

  for (const [key, byDay] of closes) {
    let carry = 0;
    let total = 0;

    for (let day = new Date(from); day <= to; day = addDays(day, 1)) {
      const close = byDay.get(isoDay(day));
      if (close !== undefined) carry = close;
      total += carry;
    }

    unitDays.set(key, total);
  }

  return unitDays;
};

export const getOutcome = async ({ id }: RunParams) => {
  const run = await prisma.planningRun.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      horizonDays: true,
      completedAt: true,
      optimization: true,
      simulation: true,
    },
  });
  if (!run) throw new NotFoundError(`Planning run '${id}' not found`);

  if (run.status !== "COMPLETED" || run.completedAt === null) {
    throw new NotFoundError(`Planning run '${id}' has no outcome to score (status ${run.status})`);
  }

  const from = startOfDay(run.completedAt);
  const horizonEnd = addDays(from, run.horizonDays);
  const today = startOfDay(new Date());
  // The horizon may not be over. Score to whichever came first.
  const to = today < horizonEnd ? today : horizonEnd;
  const elapsedDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / MS_PER_DAY));

  const [demand, movements, unitCosts] = await Promise.all([
    prisma.demandHistory.findMany({
      where: { date: { gte: from, lte: to } },
      select: {
        productId: true,
        warehouseId: true,
        orderedQuantity: true,
        fulfilledQuantity: true,
      },
    }),
    prisma.stockMovement.findMany({
      where: { date: { gte: from, lte: to } },
      select: {
        productId: true,
        warehouseId: true,
        date: true,
        movementType: true,
        quantity: true,
        stockAfter: true,
      },
      orderBy: { date: "asc" },
    }),
    loadUnitCosts(),
  ]);

  let orderedUnits = 0;
  let fulfilledUnits = 0;
  let stockoutCost = 0;

  for (const row of demand) {
    // A null fulfilled figure predates the ordered/fulfilled split, where the two were
    // the same number. Reading it as fully served is the honest interpretation.
    const fulfilled = row.fulfilledQuantity ?? row.orderedQuantity;
    const unmet = Math.max(0, row.orderedQuantity - fulfilled);

    orderedUnits += row.orderedQuantity;
    fulfilledUnits += fulfilled;
    stockoutCost += unmet * (unitCosts.get(pairKey(row.productId, row.warehouseId)) ?? ZERO_COST).stockout;
  }

  let wasteUnits = 0;
  let transferUnits = 0;
  let expiryCost = 0;

  for (const movement of movements) {
    const costs = unitCosts.get(pairKey(movement.productId, movement.warehouseId)) ?? ZERO_COST;
    const units = Math.abs(movement.quantity);

    if (movement.movementType === "WASTAGE") {
      wasteUnits += units;
      expiryCost += units * costs.expiry;
    } else if (movement.movementType === "TRANSFER_OUT") {
      transferUnits += units;
    }
  }

  let holdingCost = 0;
  for (const [key, unitDays] of holdingUnitDays(movements, from, to)) {
    holdingCost += unitDays * (unitCosts.get(key) ?? ZERO_COST).holding;
  }

  const transferCost = transferUnits * PLANNING.transferCostPerUnit;
  const totalCost = holdingCost + stockoutCost + transferCost + expiryCost;
  const unmetUnits = Math.max(0, orderedUnits - fulfilledUnits);

  const planned = run.optimization;
  const plannedServiceLevel = run.simulation?.serviceLevel ?? null;
  // Type-2 service, the same definition the simulation reports, so the two compare.
  const achievedServiceLevel = orderedUnits === 0 ? null : fulfilledUnits / orderedUnits;

  return {
    planningRunId: run.id,
    window: {
      from: isoDay(from),
      to: isoDay(to),
      elapsedDays,
      horizonDays: run.horizonDays,
      // A run scored over two of thirty days is evidence, not a verdict.
      coveragePercent: percentage(elapsedDays, run.horizonDays),
    },
    demand: {
      orderedUnits: round(orderedUnits),
      fulfilledUnits: round(fulfilledUnits),
      unmetUnits: round(unmetUnits),
      wasteUnits: round(wasteUnits),
      transferUnits: round(transferUnits),
    },
    serviceLevel: {
      planned: plannedServiceLevel === null ? null : round(plannedServiceLevel, 4),
      achieved: achievedServiceLevel === null ? null : round(achievedServiceLevel, 4),
      achievedPercent: achievedServiceLevel === null ? null : round(achievedServiceLevel * 100),
      /** Achieved minus planned. Positive means the network did better than the model said. */
      delta:
        plannedServiceLevel === null || achievedServiceLevel === null
          ? null
          : round(achievedServiceLevel - plannedServiceLevel, 4),
    },
    cost: {
      realised: {
        holding: round(holdingCost),
        stockout: round(stockoutCost),
        transfer: round(transferCost),
        expiry: round(expiryCost),
        total: round(totalCost),
      },
      /**
       * The plan's figure covers the whole horizon, so comparing it against a partly
       * elapsed window would flatter the outcome. Pro-rated by elapsed days, and null
       * before a single day has passed.
       */
      plannedToDate:
        planned === null || elapsedDays === 0
          ? null
          : round((planned.totalCost * elapsedDays) / run.horizonDays),
      plannedTotal: planned === null ? null : round(planned.totalCost),
    },
    /** Nothing has happened yet, so every figure above is zero rather than bad. */
    hasEvidence: elapsedDays > 0 && orderedUnits > 0,
  };
};
