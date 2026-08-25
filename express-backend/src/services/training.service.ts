import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import type { TrainingDataQuery } from "../zod/training.schemas.js";
import type { TrainingRow, FuturePromotionRow, FutureSignalRow } from "../types.js";

const BATCH_SIZE = 10_000;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const whereOf = (query: TrainingDataQuery): Prisma.DemandHistoryWhereInput => ({
  ...(query.from === undefined && query.to === undefined
    ? {}
    : {
        date: {
          ...(query.from === undefined ? {} : { gte: query.from }),
          ...(query.to === undefined ? {} : { lte: query.to }),
        },
      }),
  ...(query.sku === undefined ? {} : { product: { OR: [{ id: query.sku }, { sku: query.sku }] } }),
  ...(query.warehouse === undefined
    ? {}
    : { warehouse: { OR: [{ id: query.warehouse }, { code: query.warehouse }] } }),
});

const selection = {
  date: true,
  orderedQuantity: true,
  fulfilledQuantity: true,
  stockoutFlag: true,
  promotionFlag: true,
  holidayFlag: true,
  season: true,
  productId: true,
  warehouseId: true,
  product: { select: { sku: true } },
  warehouse: { select: { code: true, region: true } },
} satisfies Prisma.DemandHistorySelect;

type SelectedRow = Prisma.DemandHistoryGetPayload<{ select: typeof selection }>;

// ── Promotion & signal lookup helpers ──────────────────────────────────

interface PromotionMatch {
  type: string;
  upliftFactor: number;
}

interface SignalMatch {
  signalType: string;
  value: number;
}

// DemandSignal is regional: four rows a day, one per region, and Warehouse.region
// uses the same names. Keying on the region is what lets a flu surge in the South
// look different from a quiet Northeast - collapsing the four into one value a day
// would throw away the only variation that makes this a useful feature.
const signalKey = (region: string | null, day: string) => `${region ?? "*"}|${day}`;

/**
 * For a batch of demand-history rows, pre-load all PromotionEvents whose
 * date range overlaps the batch's date range, then match per row.
 */
const loadPromotionsForBatch = async (
  minDate: Date,
  maxDate: Date,
): Promise<Map<string, PromotionMatch>> => {
  const promotions = await prisma.promotionEvent.findMany({
    where: {
      startDate: { lte: maxDate },
      endDate: { gte: minDate },
    },
    select: {
      productId: true,
      warehouseId: true,
      startDate: true,
      endDate: true,
      type: true,
      upliftFactor: true,
    },
  });

  // Build a map keyed by "productId|warehouseId|date" for O(1) lookup.
  // A promotion with null productId applies to ALL products; similarly for warehouseId.
  const map = new Map<string, PromotionMatch>();
  for (const promo of promotions) {
    const start = promo.startDate.getTime();
    const end = promo.endDate.getTime();
    const minTime = Math.max(start, minDate.getTime());
    const maxTime = Math.min(end, maxDate.getTime());
    for (let t = minTime; t <= maxTime; t += 86_400_000) {
      const day = isoDay(new Date(t));
      // Store for specific product+warehouse, product-only, warehouse-only, and global
      const keys: string[] = [];
      if (promo.productId && promo.warehouseId) {
        keys.push(`${promo.productId}|${promo.warehouseId}|${day}`);
      } else if (promo.productId) {
        keys.push(`${promo.productId}|*|${day}`);
      } else if (promo.warehouseId) {
        keys.push(`*|${promo.warehouseId}|${day}`);
      } else {
        keys.push(`*|*|${day}`);
      }
      for (const key of keys) {
        // Keep the highest uplift if multiple promotions overlap
        const existing = map.get(key);
        if (!existing || promo.upliftFactor > existing.upliftFactor) {
          map.set(key, { type: promo.type, upliftFactor: promo.upliftFactor });
        }
      }
    }
  }
  return map;
};

/**
 * For a batch of demand-history rows, pre-load all DemandSignals in that
 * date range and build a lookup by productId+date.
 */
const loadSignalsForBatch = async (
  minDate: Date,
  maxDate: Date,
): Promise<Map<string, SignalMatch>> => {
  const signals = await prisma.demandSignal.findMany({
    where: {
      date: { gte: minDate, lte: maxDate },
    },
    select: {
      region: true,
      date: true,
      signalType: true,
      value: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Most recent row wins for a region on a day; the query is already ordered.
  const map = new Map<string, SignalMatch>();
  for (const signal of signals) {
    const key = signalKey(signal.region, isoDay(signal.date));
    if (!map.has(key)) {
      map.set(key, { signalType: signal.signalType, value: signal.value });
    }
  }
  return map;
};

/** Look up the best matching promotion for a specific row. */
const findPromotion = (
  map: Map<string, PromotionMatch>,
  productId: string,
  warehouseId: string,
  day: string,
): PromotionMatch | null => {
  // Priority: exact match > product-only > warehouse-only > global
  return (
    map.get(`${productId}|${warehouseId}|${day}`) ??
    map.get(`${productId}|*|${day}`) ??
    map.get(`*|${warehouseId}|${day}`) ??
    map.get(`*|*|${day}`) ??
    null
  );
};

/** The signal for this warehouse's region, falling back to a region-less one. */
const findSignal = (
  map: Map<string, SignalMatch>,
  region: string | null,
  day: string,
): SignalMatch | null => map.get(signalKey(region, day)) ?? map.get(signalKey(null, day)) ?? null;

// ── Row mapping ────────────────────────────────────────────────────────

const toTrainingRow = (
  row: SelectedRow,
  promoMap: Map<string, PromotionMatch>,
  signalMap: Map<string, SignalMatch>,
): TrainingRow => {
  const day = isoDay(row.date);
  const promo = findPromotion(promoMap, row.productId, row.warehouseId, day);
  const signal = findSignal(signalMap, row.warehouse.region, day);

  return {
    date: day,
    sku: row.product.sku,
    productId: row.productId,
    dc: row.warehouse.code,
    warehouseId: row.warehouseId,
    // The region a DemandSignal is keyed by. Without it a consumer cannot line the
    // forward-dated signals up with the warehouses they apply to.
    region: row.warehouse.region,
    demand: row.orderedQuantity,
    fulfilled: row.fulfilledQuantity,
    stockout: row.stockoutFlag,
    promotion: row.promotionFlag,
    holiday: row.holidayFlag,
    season: row.season,
    promotionUplift: promo?.upliftFactor ?? null,
    promotionType: promo?.type ?? null,
    demandSignalType: signal?.signalType ?? null,
    demandSignalValue: signal?.value ?? null,
  };
};

// ── Filters ────────────────────────────────────────────────────────────

const assertFiltersMatch = async (query: TrainingDataQuery): Promise<void> => {
  if (query.sku !== undefined) {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: query.sku }, { sku: query.sku }] },
      select: { id: true },
    });
    if (!product) throw new NotFoundError(`Product '${query.sku}' not found`);
  }

  if (query.warehouse !== undefined) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { OR: [{ id: query.warehouse }, { code: query.warehouse }] },
      select: { id: true },
    });
    if (!warehouse) throw new NotFoundError(`Warehouse '${query.warehouse}' not found`);
  }
};

// ── Public API ─────────────────────────────────────────────────────────

export const countTrainingRows = async (query: TrainingDataQuery): Promise<number> => {
  await assertFiltersMatch(query);
  return prisma.demandHistory.count({ where: whereOf(query) });
};

export async function* streamTrainingRows(query: TrainingDataQuery): AsyncGenerator<TrainingRow> {
  const where = whereOf(query);
  let cursor: Prisma.DemandHistoryWhereUniqueInput | undefined;

  for (;;) {
    const rows = await prisma.demandHistory.findMany({
      where,
      select: selection,
      orderBy: [{ productId: "asc" }, { warehouseId: "asc" }, { date: "asc" }],
      take: BATCH_SIZE,
      ...(cursor === undefined ? {} : { cursor, skip: 1 }),
    });

    if (rows.length === 0) return;

    // Pre-load promotions and signals for the entire batch's date range
    const dates = rows.map((r) => r.date);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    const [promoMap, signalMap] = await Promise.all([
      loadPromotionsForBatch(minDate, maxDate),
      loadSignalsForBatch(minDate, maxDate),
    ]);

    for (const row of rows) yield toTrainingRow(row, promoMap, signalMap);
    if (rows.length < BATCH_SIZE) return;

    const last = rows[rows.length - 1]!;
    cursor = {
      productId_warehouseId_date: {
        productId: last.productId,
        warehouseId: last.warehouseId,
        date: last.date,
      },
    };
  }
}

/**
 * Signals dated after the last day of demand history.
 *
 * This is the half that makes DemandSignal a *leading* indicator rather than a
 * description of the past: flu incidence is published ahead of the demand it drives,
 * so the engine needs the values for the days it is forecasting. Attaching signals
 * only to history rows would leave the forecast horizon blind.
 */
const futureSignalWhere = async (): Promise<Prisma.DemandSignalWhereInput> => {
  const last = await prisma.demandHistory.aggregate({ _max: { date: true } });
  const after = last._max.date;
  return after === null ? {} : { date: { gt: after } };
};

export const countFutureSignals = async (): Promise<number> =>
  prisma.demandSignal.count({ where: await futureSignalWhere() });

export async function* streamFutureSignals(): AsyncGenerator<FutureSignalRow> {
  const signals = await prisma.demandSignal.findMany({
    where: await futureSignalWhere(),
    select: { region: true, date: true, signalType: true, value: true },
    orderBy: [{ date: "asc" }],
  });

  for (const signal of signals) {
    yield {
      _type: "future_signal",
      region: signal.region,
      date: isoDay(signal.date),
      signalType: signal.signalType,
      value: signal.value,
    };
  }
}

/**
 * Promotions that still matter to a forecast: running right now, or starting later.
 *
 * Not `startDate > now`. A promotion that began last week and runs for another month
 * is the single most relevant one there is, and that test excludes it - while the
 * history rows cannot carry it either, because history stops before today. It would
 * have been invisible on exactly the days it is moving demand.
 */
const upcomingPromotionWhere = (): Prisma.PromotionEventWhereInput => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return { endDate: { gte: today } };
};

/** Count of upcoming promotions (for the response header). */
export const countFuturePromotions = async (): Promise<number> => {
  return prisma.promotionEvent.count({ where: upcomingPromotionWhere() });
};

/**
 * Stream the PromotionEvent rows a forecast could still be affected by, so the engine
 * can set promotion_flag on upcoming days instead of defaulting every one to 0.
 */
export async function* streamFuturePromotions(): AsyncGenerator<FuturePromotionRow> {
  const promotions = await prisma.promotionEvent.findMany({
    where: upcomingPromotionWhere(),
    select: {
      productId: true,
      warehouseId: true,
      startDate: true,
      endDate: true,
      type: true,
      upliftFactor: true,
      name: true,
    },
    orderBy: { startDate: "asc" },
  });

  for (const promo of promotions) {
    yield {
      _type: "future_promotion",
      productId: promo.productId,
      warehouseId: promo.warehouseId,
      startDate: isoDay(promo.startDate),
      endDate: isoDay(promo.endDate),
      type: promo.type,
      upliftFactor: promo.upliftFactor,
      name: promo.name,
    };
  }
}

