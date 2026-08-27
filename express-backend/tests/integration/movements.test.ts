import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";

/**
 * The execution loop. Phase 3.
 *
 * Assertions are invariant-based: they check that the ledger, the position and the
 * demand history agree with each other, never that a figure equals a seeded constant.
 */

let server: TestServer;
let warehouse: { id: string; code: string };
let product: { id: string; sku: string };

const created: string[] = [];

before(async () => {
  if (redis) await redis.flushdb();
  server = await startServer(app);

  warehouse = await prisma.warehouse.create({
    data: { code: "MOVE_W1", name: "Movement Warehouse", region: "NA", tier: "TIER_1" },
  });
  product = await prisma.product.create({
    data: {
      sku: "MOVE_P1",
      name: "Movement Product",
      category: "tablets",
      unit: "pack",
      unitCost: 10,
      shelfLifeDays: 365,
      criticality: "HIGH",
    },
  });

  await prisma.inventory.create({
    data: { productId: product.id, warehouseId: warehouse.id, onHand: 500 },
  });
});

after(async () => {
  await prisma.stockMovement.deleteMany({ where: { productId: product?.id } });
  await prisma.restockRequest.deleteMany({ where: { productId: product?.id } });
  await prisma.demandHistory.deleteMany({ where: { productId: product?.id } });
  await prisma.inventory.deleteMany({ where: { productId: product?.id } });
  await prisma.alert.deleteMany({ where: { productId: product?.id } });
  if (product) await prisma.product.deleteMany({ where: { id: product.id } });
  if (warehouse) await prisma.warehouse.deleteMany({ where: { id: warehouse.id } });
  await server.close();
  await teardown();
});

const record = (body: unknown, headers: Record<string, string> = {}) =>
  server.post(`/api/dc/${warehouse.code}/movements`, body, headers);

describe("POST /api/dc/:code/movements", () => {
  test("a sale reduces the position and the ledger agrees with it", async () => {
    const before = await prisma.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      select: { onHand: true },
    });

    const response = await record({ sku: product.sku, movementType: "SALE", quantity: 180 });
    assert.equal(response.status, 201);

    const { data } = (await response.json()) as any;
    created.push(data.movement.id);

    // The invariant the whole ledger rests on.
    assert.equal(data.movement.stockAfter, data.movement.stockBefore + data.movement.quantity);
    assert.equal(data.movement.stockBefore, before.onHand);
    assert.equal(data.movement.quantity, -180, "a sale is a negative delta");

    // The position the API reports and the row in the database are the same number.
    const after = await prisma.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      select: { onHand: true },
    });
    assert.equal(after.onHand, data.movement.stockAfter);
    assert.equal(data.inventory.onHand, after.onHand);
  });

  test("a directional type takes a magnitude and refuses a signed quantity", async () => {
    const magnitude = await record({ sku: product.sku, movementType: "SALE", quantity: 10 });
    assert.equal(magnitude.status, 201);
    const row = ((await magnitude.json()) as any).data.movement;
    created.push(row.id);
    assert.equal(row.quantity, -10, "the type carries the direction, so the ledger signs it");

    // Ambiguous - "sell 10" or "reverse a sale of 10"? Refused rather than guessed.
    const signed = await record({ sku: product.sku, movementType: "SALE", quantity: -10 });
    assert.equal(signed.status, 400);
  });

  test("an adjustment is the one type that takes a sign", async () => {
    const down = await record({ sku: product.sku, movementType: "ADJUSTMENT", quantity: -3 });
    assert.equal(down.status, 201);
    const a = ((await down.json()) as any).data.movement;
    created.push(a.id);
    assert.equal(a.quantity, -3);

    const up = await record({ sku: product.sku, movementType: "ADJUSTMENT", quantity: 3 });
    assert.equal(up.status, 201);
    const b = ((await up.json()) as any).data.movement;
    created.push(b.id);
    assert.equal(b.quantity, 3);
  });

  test("a receipt increases the position", async () => {
    const response = await record({ sku: product.sku, movementType: "RECEIPT", quantity: 50 });
    assert.equal(response.status, 201);
    const { data } = (await response.json()) as any;
    created.push(data.movement.id);
    assert.equal(data.movement.quantity, 50);
    assert.equal(data.movement.stockAfter, data.movement.stockBefore + 50);
  });

  test("a sale is appended to DemandHistory, accumulating within a day", async () => {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);

    const before = await prisma.demandHistory.findUnique({
      where: {
        productId_warehouseId_date: {
          productId: product.id,
          warehouseId: warehouse.id,
          date: day,
        },
      },
      select: { orderedQuantity: true },
    });

    const response = await record({ sku: product.sku, movementType: "SALE", quantity: 25 });
    created.push(((await response.json()) as any).data.movement.id);

    const after = await prisma.demandHistory.findUniqueOrThrow({
      where: {
        productId_warehouseId_date: {
          productId: product.id,
          warehouseId: warehouse.id,
          date: day,
        },
      },
      select: { orderedQuantity: true },
    });

    assert.equal(after.orderedQuantity, (before?.orderedQuantity ?? 0) + 25);
  });

  test("a receipt is not demand and must not touch DemandHistory", async () => {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    const key = {
      productId_warehouseId_date: { productId: product.id, warehouseId: warehouse.id, date: day },
    };

    const before = await prisma.demandHistory.findUnique({ where: key, select: { orderedQuantity: true } });
    const response = await record({ sku: product.sku, movementType: "RECEIPT", quantity: 40 });
    created.push(((await response.json()) as any).data.movement.id);
    const after = await prisma.demandHistory.findUnique({ where: key, select: { orderedQuantity: true } });

    assert.equal(after?.orderedQuantity ?? 0, before?.orderedQuantity ?? 0);
  });

  test("stock never goes negative, and the ledger records what actually moved", async () => {
    const position = await prisma.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      select: { onHand: true },
    });

    const response = await record({
      sku: product.sku,
      movementType: "SALE",
      quantity: position.onHand + 10_000,
    });
    assert.equal(response.status, 201);

    const { data } = (await response.json()) as any;
    created.push(data.movement.id);

    assert.equal(data.movement.stockAfter, 0);
    assert.equal(data.clamped, true, "the caller must be told the full quantity did not move");
    // Still consistent: the row records the delta that happened, not the one requested.
    assert.equal(data.movement.stockAfter, data.movement.stockBefore + data.movement.quantity);

    // Put the stock back so later assertions have something to work with.
    const restore = await record({ sku: product.sku, movementType: "RECEIPT", quantity: 500 });
    created.push(((await restore.json()) as any).data.movement.id);
  });

  test("a movement type cannot move stock the wrong way", async () => {
    const response = await record({ sku: product.sku, movementType: "ADJUSTMENT", quantity: 0 });
    assert.equal(response.status, 400, "a zero movement is a mistake, not a correction");
  });

  test("an unknown sku is a 404, not a silently ignored movement", async () => {
    const response = await record({ sku: "NOT_A_REAL_SKU", movementType: "SALE", quantity: 1 });
    assert.equal(response.status, 404);
  });

  test("an unknown field is rejected rather than silently dropped", async () => {
    const response = await record({
      sku: product.sku,
      movementType: "SALE",
      quantity: 1,
      warehouseId: "some-other-dc",
    });
    assert.equal(response.status, 422);
  });

  test("the same Idempotency-Key applies the movement once", async () => {
    const key = `move-${randomUUID()}`;
    const body = { sku: product.sku, movementType: "SALE" as const, quantity: 7 };

    const first = await record(body, { "idempotency-key": key });
    assert.equal(first.status, 201);
    const one = ((await first.json()) as any).data;
    created.push(one.movement.id);

    const second = await record(body, { "idempotency-key": key });
    assert.equal(second.status, 200, "a replay is not a new movement");
    const two = ((await second.json()) as any).data;

    assert.equal(two.movement.id, one.movement.id, "the replay returns the original row");

    const count = await prisma.stockMovement.count({ where: { id: one.movement.id } });
    assert.equal(count, 1);
  });
});

describe("the movement -> alert link (3.6)", () => {
  test("a movement names the alert it raised, and names none when it raised none", async () => {
    // Detection depends on settings and thresholds, so which alerts fire is not
    // asserted. What is asserted is the *relation*: the column is set exactly when
    // detection produced something for this position, and null otherwise. That
    // invariant is the feature; the specific alert is the detector's business.
    const response = await record({ sku: product.sku, movementType: "SALE", quantity: 5 });
    assert.equal(response.status, 201);

    const { data } = (await response.json()) as any;
    created.push(data.movement.id);

    const row = await prisma.stockMovement.findUniqueOrThrow({
      where: { id: data.movement.id },
      select: { triggeredAlertId: true },
    });

    if (data.alertsRaised.length === 0) {
      assert.equal(row.triggeredAlertId, null, "no alert raised, so nothing to attribute");
      return;
    }

    assert.ok(row.triggeredAlertId, "an alert was raised but the movement does not name it");
    const alert = await prisma.alert.findUnique({
      where: { id: row.triggeredAlertId },
      select: { productId: true, warehouseId: true },
    });
    assert.ok(alert, "the attributed alert must exist");
    assert.equal(alert.productId, product.id, "an alert for another SKU must not be attributed");
    assert.equal(alert.warehouseId, warehouse.id);
  });
});

describe("GET /api/inventory/movements", () => {
  test("the ledger reads back what was written, newest first", async () => {
    const response = await server.get(
      `/api/inventory/movements?sku=${product.sku}&dc=${warehouse.code}&pageSize=100`,
    );
    assert.equal(response.status, 200);

    const body = (await response.json()) as any;
    assert.ok(body.data.length > 0, "movements recorded above must be readable");

    const dates = body.data.map((row: any) => new Date(row.date).getTime());
    assert.deepEqual([...dates].sort((a, b) => b - a), dates, "must be newest first");

    for (const row of body.data) {
      assert.equal(row.stockAfter, row.stockBefore + row.quantity, "every row is self-consistent");
      assert.equal(row.dc, warehouse.code);
      assert.equal(row.sku, product.sku);
    }
  });

  test("filters by movement type", async () => {
    const response = await server.get(
      `/api/inventory/movements?sku=${product.sku}&type=RECEIPT&pageSize=100`,
    );
    const body = (await response.json()) as any;
    assert.ok(body.data.length > 0);
    for (const row of body.data) assert.equal(row.movementType, "RECEIPT");
  });

  test("paginates without dropping or repeating rows", async () => {
    const [first, second] = await Promise.all([
      server.json<any>(`/api/inventory/movements?sku=${product.sku}&page=1&pageSize=2`),
      server.json<any>(`/api/inventory/movements?sku=${product.sku}&page=2&pageSize=2`),
    ]);

    const ids = new Set([...first.data, ...second.data].map((row: any) => row.id));
    assert.equal(ids.size, first.data.length + second.data.length, "pages must not overlap");
  });
});

describe("GET /api/dc/:code/sync", () => {
  test("reports the DC as live once it has recorded a movement", async () => {
    const response = await server.get(`/api/dc/${warehouse.code}/sync`);
    assert.equal(response.status, 200);

    const { data } = (await response.json()) as any;
    assert.equal(data.code, warehouse.code);
    assert.equal(data.status, "live", "a DC that just reported in is not stale");
    assert.ok(data.lastSyncedAt !== null);
    assert.ok(data.movementsToday > 0);
    assert.ok(data.lastMovement !== null);
  });

  test("an unknown DC is a 404", async () => {
    const response = await server.get("/api/dc/NOT_A_DC/sync");
    assert.equal(response.status, 404);
  });
});

describe("restock requests", () => {
  let requestId: string;

  test("a request is created in REQUESTED and moves no stock", async () => {
    const before = await prisma.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      select: { onHand: true },
    });

    const response = await server.post("/api/restock-requests", {
      sku: product.sku,
      warehouse: warehouse.code,
      quantity: 250,
      reason: "below reorder point",
    });
    assert.equal(response.status, 201);

    const { data } = (await response.json()) as any;
    requestId = data.id;
    assert.equal(data.status, "REQUESTED");
    assert.equal(data.quantity, 250);

    const after = await prisma.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      select: { onHand: true },
    });
    assert.equal(after.onHand, before.onHand, "a request is intent, not a movement");
  });

  test("it appears in the list", async () => {
    const body = await server.json<any>(
      `/api/restock-requests?warehouse=${warehouse.code}&pageSize=100`,
    );
    assert.ok(body.data.some((row: any) => row.id === requestId));
  });

  test("approving stamps the decision", async () => {
    // The helper has no `patch`; `startServer` patches `global.fetch` to attach the
    // default token, so a plain fetch to the test server is authenticated.
    const result = await fetch(`${server.url}/api/restock-requests/${requestId}/approve`, {
      method: "PATCH",
    });

    assert.equal(result.status, 200);
    const { data } = (await result.json()) as any;
    assert.equal(data.status, "APPROVED");
    assert.ok(data.decidedAt !== null);
  });

  test("the arriving stock fulfils the request", async () => {
    const response = await record({
      sku: product.sku,
      movementType: "RECEIPT",
      quantity: 250,
      restockRequestId: requestId,
    });
    assert.equal(response.status, 201);

    const { data } = (await response.json()) as any;
    created.push(data.movement.id);

    assert.ok(data.restockRequest, "the response must say the request was closed");
    assert.equal(data.restockRequest.status, "FULFILLED");
    assert.equal(
      data.restockRequest.fulfillmentMovementId,
      data.movement.id,
      "the request must name the movement that satisfied it",
    );
  });

  test("a sale cannot fulfil a request for more stock", async () => {
    const created2 = await server.post("/api/restock-requests", {
      sku: product.sku,
      warehouse: warehouse.code,
      quantity: 10,
    });
    const other = ((await created2.json()) as any).data.id;
    await fetch(`${server.url}/api/restock-requests/${other}/approve`, { method: "PATCH" });

    const response = await record({
      sku: product.sku,
      movementType: "SALE",
      quantity: 1,
      restockRequestId: other,
    });
    assert.equal(response.status, 201);

    const { data } = (await response.json()) as any;
    created.push(data.movement.id);
    assert.equal(data.restockRequest, null, "an outward movement satisfies nothing");
  });

  test("a decided request cannot be decided again", async () => {
    const result = await fetch(`${server.url}/api/restock-requests/${requestId}/reject`, {
      method: "PATCH",
    });
    assert.equal(result.status, 409);
  });
});
