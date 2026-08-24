import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectErrorShape } from "../helpers/assertions.js";

let server: TestServer;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

interface Action {
  id: string;
  type: string;
  severity: string;
  sku: string;
  productName: string;
  criticality: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  tier: string;
  problem: string;
  recommendedAction: string;
  quantity: number | null;
  impactValue: number;
  sourceWarehouseCode: string | null;
  sourceWarehouseName: string | null;
}

interface ActionsReport {
  items: Action[];
  counts: { critical: number; high: number; medium: number; low: number; total: number };
}

const actions = async (query = "") =>
  expectEnvelope<ActionsReport>(await server.json("/api/dashboard/priority-actions" + query)).data;

const TYPES = [
  "TRANSFER_OPPORTUNITY",
  "STOCKOUT_IMMINENT",
  "BELOW_REORDER_POINT",
  "EXPIRY_WRITE_OFF",
  "EXCESS_STOCK",
] as const;

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

describe("GET /api/dashboard/priority-actions", () => {
  test("returns a ranked list with filter-wide counts", async () => {
    const response = await server.get("/api/dashboard/priority-actions");
    assert.equal(response.status, 200);

    const { data } = expectEnvelope<ActionsReport>(await response.json());
    assert.ok(Array.isArray(data.items));
    assert.ok(data.counts);
    assert.ok(data.items.length <= 10, "the default limit is 10");
  });

  test("never asks a planner to move zero units", async () => {
    const report = await actions("?limit=50");
    for (const action of report.items) {
      assert.notEqual(action.quantity, 0, action.id + " is an action to do nothing");
      if (action.quantity !== null) {
        assert.ok(
          action.quantity >= 1,
          action.id + " has a sub-unit quantity of " + action.quantity + ", which rounds to a meaningless instruction",
        );
      }
    }
  });

  test("the recommended action text never contains a zero quantity", async () => {
    const report = await actions("?limit=50");
    for (const action of report.items) {
      assert.ok(
        !/\b0 units\b/.test(action.recommendedAction),
        action.id + " renders as: " + action.recommendedAction,
      );
    }
  });

  test("carries every documented field with the documented type", async () => {
    for (const action of (await actions("?limit=50")).items) {
      assert.equal(typeof action.id, "string");
      assert.ok(TYPES.includes(action.type as (typeof TYPES)[number]), "unexpected type " + action.type);
      assert.ok(["critical", "high", "medium", "low"].includes(action.severity));
      assert.equal(typeof action.sku, "string");
      assert.equal(typeof action.warehouseCode, "string");
      assert.ok(action.problem.length > 0, "an action must state the problem");
      assert.ok(action.recommendedAction.length > 0, "an action must state what to do");
      assert.equal(typeof action.impactValue, "number");
      assert.ok(action.impactValue >= 0);
    }
  });

  test("ids are unique and deterministic", async () => {
    const first = await actions("?limit=50");
    const ids = first.items.map((action) => action.id);
    assert.equal(new Set(ids).size, ids.length, "two actions shared an id");

    const second = await actions("?limit=50");
    assert.deepEqual(second.items.map((action) => action.id), ids, "ids must be stable across calls");
  });

  test("only transfers name a source warehouse", async () => {
    for (const action of (await actions("?limit=50")).items) {
      if (action.type === "TRANSFER_OPPORTUNITY") {
        assert.ok(action.sourceWarehouseCode, "a transfer must say where the stock comes from");
        assert.ok(action.sourceWarehouseName);
        assert.notEqual(
          action.sourceWarehouseCode,
          action.warehouseCode,
          "a transfer to and from the same warehouse is meaningless",
        );
      } else {
        assert.equal(action.sourceWarehouseCode, null, action.type + " must not name a source");
        assert.equal(action.sourceWarehouseName, null);
      }
    }
  });

  test("counts sum to the total", async () => {
    const { counts } = await actions("?limit=1");
    assert.equal(
      counts.critical + counts.high + counts.medium + counts.low,
      counts.total,
      "every action must fall into exactly one severity band",
    );
  });

  test("counts describe the whole filter, not the returned page", async () => {
    const limited = await actions("?limit=1");
    if (limited.counts.total > 1) {
      assert.equal(limited.items.length, 1);
      assert.ok(limited.counts.total > limited.items.length, "badge counts must survive a small limit");
    }
  });

  test("orders by severity, then by impact value", async () => {
    const { items } = await actions("?limit=50");
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1]!;
      const current = items[index]!;
      const rank = SEVERITY_RANK[previous.severity]! - SEVERITY_RANK[current.severity]!;

      assert.ok(rank <= 0, "severity must not improve as the list goes down");
      if (rank === 0) {
        assert.ok(
          previous.impactValue >= current.impactValue,
          "within a severity band, the expensive actions come first",
        );
      }
    }
  });

  test("filters by type", async () => {
    for (const type of TYPES) {
      const { items } = await actions("?limit=50&type=" + type);
      for (const action of items) assert.equal(action.type, type);
    }
  });

  test("type counts partition the whole set", async () => {
    const all = await actions("?limit=1");
    let counted = 0;
    for (const type of TYPES) counted += (await actions("?limit=1&type=" + type)).counts.total;

    assert.equal(counted, all.counts.total, "every action must have exactly one of the five types");
  });

  test("filters by severity", async () => {
    for (const severity of ["critical", "high", "medium", "low"]) {
      const { items, counts } = await actions("?limit=50&severity=" + severity);
      for (const action of items) assert.equal(action.severity, severity);
      assert.equal(counts.total, counts[severity as keyof typeof counts]);
    }
  });

  test("filters by destination warehouse", async () => {
    const { data: warehouses } = expectEnvelope<{ id: string }[]>(await server.json("/api/warehouses"));
    const target = warehouses[0]!.id;

    const { items } = await actions("?limit=50&warehouseId=" + target);
    for (const action of items) assert.equal(action.warehouseId, target);
  });

  test("respects the limit", async () => {
    const { items } = await actions("?limit=3");
    assert.ok(items.length <= 3);
  });

  test("a partial transfer leaves a smaller residual, not a duplicate of the full shortage", async () => {
    const { items } = await actions("?limit=50");
    const transfers = items.filter((action) => action.type === "TRANSFER_OPPORTUNITY");

    for (const transfer of transfers) {
      const residual = items.find(
        (action) =>
          action.sku === transfer.sku &&
          action.warehouseId === transfer.warehouseId &&
          (action.type === "STOCKOUT_IMMINENT" || action.type === "BELOW_REORDER_POINT"),
      );
      if (!residual) continue;

      const shortage = Number(/^([\d,]+) units short/.exec(transfer.problem)?.[1]?.replace(/,/g, ""));
      assert.ok(Number.isFinite(shortage), "transfer problem text should state the shortage");
      assert.ok(
        residual.quantity! < shortage,
        transfer.sku + " at " + transfer.warehouseCode + ": residual " + residual.quantity +
          " is not smaller than the original shortage " + shortage,
      );
      assert.equal(
        transfer.quantity! + residual.quantity!,
        shortage,
        "the transfer and its residual must add up to the original shortage",
      );
    }
  });

  test("a position never raises both shortage types at once", async () => {
    const { items } = await actions("?limit=50");
    const seen = new Set<string>();

    for (const action of items) {
      if (action.type !== "STOCKOUT_IMMINENT" && action.type !== "BELOW_REORDER_POINT") continue;
      const key = action.sku + ":" + action.warehouseId;
      assert.ok(!seen.has(key), key + " raised two competing shortage actions");
      seen.add(key);
    }
  });

  test("a source warehouse still reports the expiry risk a transfer did not absorb", async () => {
    const { items } = await actions("?limit=50");
    for (const action of items.filter((row) => row.type === "EXPIRY_WRITE_OFF")) {
      assert.ok(
        action.quantity !== null && action.quantity >= 1,
        "residual waste must be reported, not suppressed by a partial transfer",
      );
    }
  });

  test("an unknown warehouse is a 404", async () => {
    const response = await server.get("/api/dashboard/priority-actions?warehouseId=does-not-exist");
    assert.equal(response.status, 404);
    expectErrorShape(await response.json(), "NOT_FOUND");
  });

  test("rejects malformed parameters", async () => {
    for (const query of ["?limit=0", "?limit=51", "?type=BOGUS", "?severity=CRITICAL"]) {
      const response = await server.get("/api/dashboard/priority-actions" + query);
      assert.equal(response.status, 422, query + " should be rejected");
      expectErrorShape(await response.json(), "VALIDATION_FAILED");
    }
  });
});
