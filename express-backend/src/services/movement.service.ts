import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/errors.js";
import { consumeFefo, round } from "../utils/inventory.js";
import {
  applyDelta,
  deltaFor,
  isDemand,
  isValidQuantity,
  wasClamped,
  type MovementType,
} from "../utils/movement.js";
import { refreshAlerts } from "./alert-detector.service.js";
import { fulfilRestockRequest } from "./restock.service.js";
import { abandon, complete, reserve } from "../lib/idempotency.js";
import { PLANNING } from "../config/constants.js";
import type {
  InventoryPlanQuery,
  MovementQuery,
  RecordMovementBody,
} from "../zod/movement.schemas.js";

/**
 * The write half of the execution loop.
 *
 * `StockMovement` existed in the schema and nothing wrote it; `Inventory` was
 * read-only. This is the route that closes the loop the architecture doc describes:
 * a transaction changes stock, changed stock re-runs detection, detection raises an
 * alert, and the alert names the movement that caused it.
 *
 * **Scope boundary.** This mutates `Inventory` and appends `DemandHistory` - the two
 * things the planning executor is forbidden from touching. That asymmetry is
 * deliberate: a `DRPPlan` is a proposal, a movement is a fact.
 */

const MS_PER_DAY = 86_400_000;

const resolveProduct = async (sku: string) => {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: sku }, { sku }] },
    select: { id: true, sku: true, name: true, shelfLifeDays: true },
  });
  if (!product) throw new NotFoundError(`Product '${sku}' not found`);
  return product;
};

const resolveWarehouse = async (warehouse: string) => {
  const row = await prisma.warehouse.findFirst({
    where: { OR: [{ id: warehouse }, { code: warehouse }] },
    select: { id: true, code: true, name: true },
  });
  if (!row) throw new NotFoundError(`Warehouse '${warehouse}' not found`);
  return row;
};

/** The calendar day a movement lands on. `DemandHistory` is keyed per day, not per event. */
const startOfDay = (date: Date) => {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
};

const movementSelect = {
  id: true,
  date: true,
  movementType: true,
  sku: true,
  productId: true,
  quantity: true,
  stockBefore: true,
  stockAfter: true,
  warehouseId: true,
  fromLocation: true,
  toLocation: true,
  reference: true,
  userOrSystem: true,
  triggeredAlertId: true,
  createdAt: true,
  product: { select: { sku: true, name: true } },
  warehouse: { select: { code: true, name: true } },
} satisfies Prisma.StockMovementSelect;

type MovementRow = Prisma.StockMovementGetPayload<{ select: typeof movementSelect }>;

const toMovement = (row: MovementRow) => ({
  id: row.id,
  date: row.date.toISOString(),
  movementType: row.movementType,
  sku: row.product.sku,
  productId: row.productId,
  productName: row.product.name,
  warehouseId: row.warehouseId,
  // The wire name is `dc`: it is what the ledger column is headed, and the id travels
  // beside it so a link can be built without a second lookup.
  dc: row.warehouse.code,
  warehouseName: row.warehouse.name,
  quantity: row.quantity,
  stockBefore: row.stockBefore,
  stockAfter: row.stockAfter,
  fromLocation: row.fromLocation,
  toLocation: row.toLocation,
  reference: row.reference,
  userOrSystem: row.userOrSystem,
  triggeredAlertId: row.triggeredAlertId,
  createdAt: row.createdAt.toISOString(),
});

export type Movement = ReturnType<typeof toMovement>;

interface RaisedAlert {
  id: string;
  severity: string;
  type: string;
  title: string;
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

/** An unrecognised severity sorts last rather than ahead of everything. */
const severityRank = (severity: string): number => {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? SEVERITY_ORDER.length : index;
};

const mostSevere = (alerts: RaisedAlert[]): RaisedAlert =>
  [...alerts].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0]!;

/**
 * Arrivals that carry a known expiry, so a batch can be opened for them.
 *
 * A positive ADJUSTMENT is deliberately not one: a stock count correcting upwards has
 * no provenance, and dating a batch from the shelf life would invent an expiry the
 * warehouse never stated. A RETURN is the same - the units came back from somewhere,
 * and their original batch is not knowable from this request.
 */
const OPENS_BATCH = new Set<MovementType>(["RECEIPT", "TRANSFER_IN"]);

const batchNumberFor = (sku: string, date: Date) =>
  `B-${sku.split("-")[1] ?? "GEN"}-${date.toISOString().slice(0, 10).replace(/-/g, "")}`;

/**
 * Keeps the batch sub-ledger in step with the position.
 *
 * `InventoryBatch` was written by the seed and by nothing else, so every FEFO
 * projection, expiry exposure and waste figure read a table frozen at seed time while
 * `Inventory.onHand` moved underneath it. Outward stock now draws down batches
 * earliest-expiry-first, which is the order those same readers assume.
 *
 * Batches drained to zero are deleted rather than left at zero: none of the expiry
 * reads filter on quantity, so a spent batch would keep appearing as at-risk stock.
 * The movement ledger is where the history lives.
 *
 * Returns how many units the sub-ledger could not account for, which is expected on a
 * position seeded without batches and is not an error.
 */
const syncBatches = async (
  tx: Prisma.TransactionClient,
  input: {
    productId: string;
    warehouseId: string;
    sku: string;
    movementType: MovementType;
    delta: number;
    date: Date;
    shelfLifeDays: number | null;
  },
): Promise<number> => {
  if (input.delta < 0) {
    const batches = await tx.inventoryBatch.findMany({
      where: { productId: input.productId, warehouseId: input.warehouseId, quantity: { gt: 0 } },
      select: { id: true, quantity: true },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
    });

    const { draws, shortfall } = consumeFefo(batches, Math.abs(input.delta));

    for (const draw of draws) {
      if (draw.remaining <= 0) await tx.inventoryBatch.delete({ where: { id: draw.id } });
      else await tx.inventoryBatch.update({ where: { id: draw.id }, data: { quantity: draw.remaining } });
    }

    return shortfall;
  }

  if (input.delta > 0 && OPENS_BATCH.has(input.movementType) && input.shelfLifeDays !== null) {
    const expiryDate = new Date(input.date.getTime() + input.shelfLifeDays * MS_PER_DAY);

    await tx.inventoryBatch.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        batchNumber: batchNumberFor(input.sku, input.date),
        quantity: round(input.delta),
        manufacturingDate: input.date,
        expiryDate,
      },
    });
  }

  return 0;
};

/**
 * Records one movement.
 *
 * The stock read, the ledger write and the position update are **one transaction**:
 * two concurrent sales against the same position would otherwise both read the same
 * `stockBefore` and the second would overwrite the first, losing a movement's worth of
 * stock. Detection runs *after* it commits - it reads its own connection, and holding
 * a transaction open across a full detection cycle would block every other writer for
 * seconds.
 */
const recordMovementOnce = async (
  warehouseCode: string,
  body: RecordMovementBody,
  actorId?: string,
) => {
  const [product, warehouse] = await Promise.all([
    resolveProduct(body.sku),
    resolveWarehouse(warehouseCode),
  ]);

  if (!isValidQuantity(body.movementType as MovementType, body.quantity)) {
    throw new BadRequestError(
      `A ${body.movementType} cannot move ${body.quantity} units`,
      {
        details: {
          movementType: body.movementType,
          quantity: body.quantity,
          expected:
            body.movementType === "ADJUSTMENT"
              ? "a non-zero quantity, positive or negative"
              : "a positive quantity - the movement type already carries the direction",
        },
      },
    );
  }

  const requested = deltaFor(body.movementType as MovementType, body.quantity);
  const date = body.date ?? new Date();

  const { movement, inventory, clamped, batchShortfall } = await prisma.$transaction(async (tx) => {
    // The position is created on first movement rather than assumed to exist: a DC can
    // legitimately receive a SKU it has never held.
    const position = await tx.inventory.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      create: { productId: product.id, warehouseId: warehouse.id, onHand: 0 },
      update: {},
      select: { onHand: true, reserved: true, inTransit: true },
    });

    const change = applyDelta(position.onHand, requested);

    const written = await tx.stockMovement.create({
      data: {
        date,
        movementType: body.movementType,
        sku: product.sku,
        productId: product.id,
        warehouseId: warehouse.id,
        // The applied delta, not the requested one, so stockAfter = stockBefore +
        // quantity holds even on a movement that was clamped at zero.
        quantity: round(change.delta),
        stockBefore: round(change.stockBefore),
        stockAfter: round(change.stockAfter),
        ...(body.fromLocation === undefined ? {} : { fromLocation: body.fromLocation }),
        ...(body.toLocation === undefined ? {} : { toLocation: body.toLocation }),
        ...(body.reference === undefined ? {} : { reference: body.reference }),
        userOrSystem: actorId ?? "system",
      },
      select: movementSelect,
    });

    const updated = await tx.inventory.update({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      data: { onHand: round(change.stockAfter) },
      select: { onHand: true, reserved: true, inTransit: true, updatedAt: true },
    });

    const batchShortfall = await syncBatches(tx, {
      productId: product.id,
      warehouseId: warehouse.id,
      sku: product.sku,
      movementType: body.movementType as MovementType,
      delta: change.delta,
      date,
      shelfLifeDays: product.shelfLifeDays,
    });

    // A sale is realised demand, so it belongs in the history the forecaster trains
    // on. Accumulated per day rather than overwritten: two sales on one day are one
    // day's demand, and `@@unique([productId, warehouseId, date])` makes that an upsert.
    if (isDemand(body.movementType as MovementType)) {
      // Ordered is what the customer asked for; fulfilled is what stock allowed. They
      // used to both be the shipped figure, which made unmet demand unrecoverable:
      // every fill rate computed off this table was 100% by construction, and the
      // forecaster trained on demand censored by whatever happened to be on the shelf.
      const ordered = Math.abs(requested);
      const shipped = Math.abs(change.delta);

      await tx.demandHistory.upsert({
        where: {
          productId_warehouseId_date: {
            productId: product.id,
            warehouseId: warehouse.id,
            date: startOfDay(date),
          },
        },
        create: {
          productId: product.id,
          warehouseId: warehouse.id,
          date: startOfDay(date),
          orderedQuantity: ordered,
          fulfilledQuantity: shipped,
          // The request was cut short by available stock, which is what a stockout is.
          stockoutFlag: wasClamped(position.onHand, requested),
        },
        update: {
          orderedQuantity: { increment: ordered },
          fulfilledQuantity: { increment: shipped },
          // Sticky for the day: one cut-short order makes the day a stockout day.
          ...(wasClamped(position.onHand, requested) ? { stockoutFlag: true } : {}),
        },
      });
    }

    // The DC has just reported in, which is what "synced" means here. Phase 3.3.
    await tx.warehouse.update({
      where: { id: warehouse.id },
      data: { lastSyncedAt: new Date() },
    });

    return {
      movement: written,
      inventory: updated,
      clamped: wasClamped(position.onHand, requested),
      batchShortfall,
    };
  });

  // Expected on a position seeded without batches, so it is reported and not raised.
  if (batchShortfall > 0) {
    console.warn("batch ledger did not cover the movement", {
      movementId: movement.id,
      sku: product.sku,
      units: batchShortfall,
    });
  }

  const alertsRaised = await raiseAlertsFor(movement.id, product.id, warehouse.id);

  // Closing the request is what makes `FULFILLED` reachable: the stock arriving is the
  // event, not a button someone presses. Only an inward movement can satisfy one -
  // a sale does not fulfil a request for more stock.
  const restockRequest =
    body.restockRequestId !== undefined && requested > 0
      ? await fulfilRestockRequest(body.restockRequestId, movement.id)
      : null;

  return {
    movement: toMovement(movement),
    inventory: {
      productId: product.id,
      warehouseId: warehouse.id,
      onHand: inventory.onHand,
      reserved: inventory.reserved,
      inTransit: inventory.inTransit,
      available: round(inventory.onHand - inventory.reserved),
      updatedAt: inventory.updatedAt.toISOString(),
    },
    alertsRaised,
    restockRequest,
    // Reported rather than hidden: the caller asked to move more than existed, and a
    // silent clamp would leave them believing the full quantity moved.
    clamped,
  };
};

/**
 * Records a movement, at most once per `Idempotency-Key`.
 *
 * A retried POST is the normal case here, not the exotic one: a DC terminal on a bad
 * connection resends, and without this the same sale is applied twice and the position
 * is silently wrong. The key stores the movement id, and a replay re-reads that row
 * rather than re-applying anything.
 *
 * Without Redis configured `reserve` reports `disabled` and the write proceeds
 * unguarded - the same degradation every other idempotent route accepts.
 */
export const recordMovement = async (
  warehouseCode: string,
  body: RecordMovementBody,
  idempotencyKey?: string,
  actorId?: string,
) => {
  if (idempotencyKey === undefined) {
    return { ...(await recordMovementOnce(warehouseCode, body, actorId)), replayed: false };
  }

  const reservation = await reserve(idempotencyKey, PLANNING.idempotencyTtlMs);

  if (reservation.kind === "in-flight") {
    throw new ConflictError("A request with this Idempotency-Key is still in flight");
  }

  if (reservation.kind === "replay") {
    const row = await prisma.stockMovement.findUnique({
      where: { id: reservation.value },
      select: movementSelect,
    });
    if (row) {
      const position = await prisma.inventory.findUnique({
        where: { productId_warehouseId: { productId: row.productId, warehouseId: row.warehouseId } },
        select: { onHand: true, reserved: true, inTransit: true, updatedAt: true },
      });
      return {
        movement: toMovement(row),
        inventory: {
          productId: row.productId,
          warehouseId: row.warehouseId,
          onHand: position?.onHand ?? row.stockAfter,
          reserved: position?.reserved ?? 0,
          inTransit: position?.inTransit ?? 0,
          available: round((position?.onHand ?? row.stockAfter) - (position?.reserved ?? 0)),
          updatedAt: (position?.updatedAt ?? row.createdAt).toISOString(),
        },
        // A replay raises nothing: detection already ran on the original write.
        alertsRaised: [] as RaisedAlert[],
        restockRequest: null,
        clamped: false,
        replayed: true,
      };
    }
    await abandon(idempotencyKey);
  }

  try {
    const result = await recordMovementOnce(warehouseCode, body, actorId);
    await complete(idempotencyKey, result.movement.id, PLANNING.idempotencyTtlMs);
    return { ...result, replayed: false };
  } catch (error) {
    await abandon(idempotencyKey);
    throw error;
  }
};

/**
 * Re-runs detection and attributes anything new to the movement that caused it.
 *
 * Phase 3.6. The link is established by *what detection produced*, not by guessing:
 * only alerts for this exact position, raised after the movement committed, are
 * attributed. An alert that was already open is a pre-existing condition the movement
 * did not cause, so it is left alone.
 *
 * Detection failing must not fail the movement - the stock has already moved, and a
 * `500` here would tell the caller their transaction was rejected when it was not.
 */
const raiseAlertsFor = async (
  movementId: string,
  productId: string,
  warehouseId: string,
): Promise<RaisedAlert[]> => {
  const before = new Date();

  try {
    await refreshAlerts();
  } catch (error) {
    console.error("detection after a movement failed", { movementId, error });
    return [];
  }

  const raised = await prisma.alert.findMany({
    where: { productId, warehouseId, detectedAt: { gte: before } },
    select: { id: true, severity: true, type: true, title: true },
    orderBy: { detectedAt: "desc" },
  });

  if (raised.length === 0) return [];

  // One movement, one attributed alert: the column holds a single id, and the most
  // severe new condition is the one a reader wants named.
  const primary = mostSevere(raised);
  await prisma.stockMovement.update({
    where: { id: movementId },
    data: { triggeredAlertId: primary.id },
  });

  return raised;
};

/** The ledger read. Phase 3.2. */
export const listMovements = async (
  query: MovementQuery,
  authScope?: { warehouseId?: string | null },
) => {
  const requested = authScope?.warehouseId ?? query.warehouse ?? query.dc;

  const [productId, warehouseId] = await Promise.all([
    query.sku === undefined ? undefined : resolveProduct(query.sku).then((row) => row.id),
    requested === undefined || requested === null
      ? undefined
      : resolveWarehouse(requested).then((row) => row.id),
  ]);

  const where: Prisma.StockMovementWhereInput = {
    ...(productId === undefined ? {} : { productId }),
    ...(warehouseId === undefined ? {} : { warehouseId }),
    ...(query.type === undefined ? {} : { movementType: query.type }),
    ...(query.from === undefined && query.to === undefined
      ? {}
      : {
          date: {
            ...(query.from === undefined ? {} : { gte: query.from }),
            ...(query.to === undefined ? {} : { lte: query.to }),
          },
        }),
  };

  const [total, rows] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      select: movementSelect,
      // Newest first, then by id: two movements can share a timestamp to the
      // millisecond, and an unstable order makes paging drop or repeat rows.
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: rows.map(toMovement), total };
};

/**
 * When each DC last reported in. Phase 3.3.
 *
 * `lastSyncedAt` is null until a DC records its first movement, and that reads as
 * "never synced" rather than as a stale timestamp - the honest answer for a network
 * where the write path has only just been built.
 */
export const getDcSync = async (warehouseCode: string) => {
  const warehouse = await resolveWarehouse(warehouseCode);

  const [row, lastMovement, positions] = await Promise.all([
    prisma.warehouse.findUniqueOrThrow({
      where: { id: warehouse.id },
      select: { lastSyncedAt: true, isActive: true },
    }),
    prisma.stockMovement.findFirst({
      where: { warehouseId: warehouse.id },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      select: movementSelect,
    }),
    prisma.inventory.aggregate({
      where: { warehouseId: warehouse.id },
      _count: true,
      _sum: { onHand: true },
    }),
  ]);

  const lastSyncedAt = row.lastSyncedAt;
  const movementsToday = await prisma.stockMovement.count({
    where: { warehouseId: warehouse.id, date: { gte: startOfDay(new Date()) } },
  });

  return {
    warehouseId: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    isActive: row.isActive,
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    minutesSinceSync:
      lastSyncedAt === null
        ? null
        : Math.floor((Date.now() - lastSyncedAt.getTime()) / 60_000),
    /** `never` until the DC has reported once - not `stale`, which implies it used to. */
    status:
      lastSyncedAt === null
        ? "never"
        : Date.now() - lastSyncedAt.getTime() > MS_PER_DAY
          ? "stale"
          : "live",
    movementsToday,
    positionsHeld: positions._count,
    onHandUnits: round(positions._sum.onHand ?? 0),
    lastMovement: lastMovement === null ? null : toMovement(lastMovement),
  };
};

/**
 * The projection curve for one position. Phase 3.4.
 *
 * The executor already writes `InventoryPlan` per position per day and nothing read
 * it. This is a **read** - it does not recompute anything, because a slice recomputed
 * in isolation plans against stale inventory (the reason Phase D rejected per-stage
 * write endpoints).
 */
export const getInventoryPlans = async (
  runId: string,
  query: InventoryPlanQuery,
  authScope?: { warehouseId?: string | null },
) => {
  const run = await prisma.planningRun.findUnique({
    where: { id: runId },
    select: { id: true, status: true, horizonDays: true },
  });
  if (!run) throw new NotFoundError(`Planning run '${runId}' not found`);

  const requested = authScope?.warehouseId ?? query.warehouse;

  const [productId, warehouseId] = await Promise.all([
    query.sku === undefined ? undefined : resolveProduct(query.sku).then((row) => row.id),
    requested === undefined || requested === null
      ? undefined
      : resolveWarehouse(requested).then((row) => row.id),
  ]);

  const isPosition = productId !== undefined && warehouseId !== undefined;

  /**
   * A run holds ~4,800 plan rows and as many forecasts. Narrowed to one position that
   * is a curve of `horizonDays` points; unnarrowed it is every pair overlaid, which no
   * chart can render honestly. The unnarrowed request is answered with a bounded
   * sample and `scope: "aggregate"` so a caller that forgot to narrow gets told,
   * rather than being shipped ten thousand rows it cannot use.
   */
  const rows = await prisma.inventoryPlan.findMany({
    where: {
      planningRunId: runId,
      ...(productId === undefined ? {} : { productId }),
      ...(warehouseId === undefined ? {} : { warehouseId }),
    },
    orderBy: { date: "asc" },
    ...(isPosition ? {} : { take: 500 }),
    select: {
      date: true,
      forecastDemand: true,
      safetyStock: true,
      reorderPoint: true,
      openingInventory: true,
      projectedInventory: true,
      netRequirement: true,
      daysOfSupply: true,
      productId: true,
      warehouseId: true,
    },
  });

  // The band comes from Forecast rather than InventoryPlan, which stores only the p50
  // it planned against. Fetched per day so the chart can draw the uncertainty the
  // planner actually used - and only for a single position, because a band is a
  // statement about one pair and means nothing summed across the network.
  const bands = isPosition
    ? await prisma.forecast.findMany({
        where: { planningRunId: runId, productId, warehouseId },
        select: {
          forecastDate: true,
          productId: true,
          warehouseId: true,
          p10: true,
          p50: true,
          p90: true,
        },
      })
    : [];

  const bandKey = (pid: string, wid: string, date: Date) =>
    `${pid}:${wid}:${date.toISOString().slice(0, 10)}`;
  const bandBy = new Map(
    bands.map((row) => [bandKey(row.productId, row.warehouseId, row.forecastDate), row]),
  );

  const points = rows.map((row) => {
    const band = bandBy.get(bandKey(row.productId, row.warehouseId, row.date));
    return {
      date: row.date.toISOString().slice(0, 10),
      projectedOnHand: round(row.projectedInventory),
      openingInventory: round(row.openingInventory),
      forecastDemand: round(row.forecastDemand),
      safetyStock: round(row.safetyStock),
      reorderPoint: round(row.reorderPoint),
      netRequirement: round(row.netRequirement),
      daysOfSupply: row.daysOfSupply === null ? null : round(row.daysOfSupply),
      // Null rather than a fabricated band when the run produced no forecast row for
      // this day - which happens on a fallback run that forecast fewer days than it planned.
      p10: band === undefined ? null : round(band.p10),
      p50: band === undefined ? null : round(band.p50),
      p90: band === undefined ? null : round(band.p90),
    };
  });

  // The first day the projection crosses zero. This is the number the Decision Card
  // calls "stockout date", and it is read off the curve rather than recomputed.
  // Only meaningful for a single position: the first day *some* pair in an overlaid
  // set hits zero is not a date anyone can act on.
  const crossing = isPosition ? points.find((point) => point.projectedOnHand <= 0) : undefined;

  return {
    planningRunId: run.id,
    status: run.status,
    horizonDays: run.horizonDays,
    // A single pair asked for is a curve; the whole run is many curves overlaid, which
    // no chart can read - so the caller is told what it is looking at.
    scope: isPosition ? "position" : "aggregate",
    points,
    stockoutDate: crossing?.date ?? null,
  };
};

/** Guards a transition the way the recommendation and supply-plan lifecycles do. */
export const assertActionable = (status: string, id: string, action: string) => {
  if (status !== "REQUESTED") {
    throw new ConflictError(`Restock request '${id}' is ${status} and cannot be ${action}`, {
      id,
      status,
    });
  }
};
