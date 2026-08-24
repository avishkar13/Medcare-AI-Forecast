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

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  unitCost: number;
  shelfLifeDays: number | null;
  criticality: string;
  isActive: boolean;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
  region: string | null;
  tier: string;
  location: string | null;
  capacity: number | null;
  isActive: boolean;
}

describe("GET /api/products", () => {
  test("returns a paginated envelope", async () => {
    const response = await server.get("/api/products");
    assert.equal(response.status, 200);

    const { data, meta } = expectEnvelope<Product[]>(await response.json());
    assert.ok(Array.isArray(data));
    assert.equal(meta.page, 1);
    assert.equal(meta.pageSize, 50);
    assert.equal(typeof meta.total, "number");
  });

  test("every product carries the documented fields with the documented types", async () => {
    const { data } = expectEnvelope<Product[]>(await server.json("/api/products?pageSize=5"));
    assert.ok(data.length > 0, "seed data is missing - run pnpm prisma:seed");

    for (const product of data) {
      assert.equal(typeof product.id, "string");
      assert.equal(typeof product.sku, "string");
      assert.equal(typeof product.name, "string");
      assert.equal(typeof product.unit, "string");
      assert.equal(typeof product.unitCost, "number", "Decimal must be serialised as a number, not a string");
      assert.ok(Number.isFinite(product.unitCost));
      assert.equal(typeof product.isActive, "boolean");
      assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(product.criticality));
      assert.ok(product.category === null || typeof product.category === "string");
      assert.ok(product.shelfLifeDays === null || typeof product.shelfLifeDays === "number");
    }
  });

  test("orders by sku ascending", async () => {
    const { data } = expectEnvelope<Product[]>(await server.json("/api/products?pageSize=200"));
    const skus = data.map((product) => product.sku);
    assert.deepEqual(skus, [...skus].sort(), "documented order is sku ascending");
  });

  test("total describes the filter, not the page", async () => {
    const page = expectEnvelope<Product[]>(await server.json("/api/products?pageSize=2"));
    assert.equal(page.data.length, 2);
    assert.ok(page.meta.total! > 2, "total must count every match, not the page");
  });

  test("pages do not overlap", async () => {
    const first = expectEnvelope<Product[]>(await server.json("/api/products?pageSize=3&page=1"));
    const second = expectEnvelope<Product[]>(await server.json("/api/products?pageSize=3&page=2"));

    const firstIds = new Set(first.data.map((product) => product.id));
    for (const product of second.data) {
      assert.ok(!firstIds.has(product.id), "page 2 repeated a row from page 1");
    }
    assert.equal(first.meta.total, second.meta.total, "total must not shift between pages");
  });

  test("a page past the end is empty but still reports the total", async () => {
    const { data, meta } = expectEnvelope<Product[]>(await server.json("/api/products?page=999&pageSize=50"));
    assert.deepEqual(data, []);
    assert.ok(meta.total! > 0);
  });

  test("search matches sku or name, case insensitively", async () => {
    const byName = expectEnvelope<Product[]>(await server.json("/api/products?search=lisi"));
    assert.ok(byName.data.length > 0, "expected a match on product name");
    for (const product of byName.data) {
      const haystack = (product.sku + " " + product.name).toLowerCase();
      assert.ok(haystack.includes("lisi"), product.sku + " does not match the search term");
    }

    const bySku = expectEnvelope<Product[]>(await server.json("/api/products?search=SKU-LIS"));
    assert.ok(bySku.data.length > 0, "expected a match on sku");
  });

  test("filters by criticality", async () => {
    const { data, meta } = expectEnvelope<Product[]>(
      await server.json("/api/products?criticality=CRITICAL&pageSize=200"),
    );
    assert.ok(data.length > 0);
    for (const product of data) assert.equal(product.criticality, "CRITICAL");

    const all = expectEnvelope<Product[]>(await server.json("/api/products?pageSize=200"));
    assert.ok(meta.total! < all.meta.total!, "a filter must narrow the result set");
  });

  test("filters by category", async () => {
    const { data } = expectEnvelope<Product[]>(
      await server.json("/api/products?category=Antibiotics&pageSize=200"),
    );
    assert.ok(data.length > 0);
    for (const product of data) assert.equal(product.category, "Antibiotics");
  });

  test("filters by isActive", async () => {
    const { data } = expectEnvelope<Product[]>(await server.json("/api/products?isActive=true&pageSize=200"));
    for (const product of data) assert.equal(product.isActive, true);
  });

  test("rejects invalid pagination and names the offending field", async () => {
    for (const [query, field] of [
      ["page=0", "page"],
      ["page=-1", "page"],
      ["pageSize=0", "pageSize"],
      ["pageSize=201", "pageSize"],
      ["page=abc", "page"],
    ] as const) {
      const response = await server.get("/api/products?" + query);
      assert.equal(response.status, 422, query + " should be rejected");

      const body = expectErrorShape(await response.json(), "VALIDATION_FAILED");
      const paths = (body.error.details as { path: string }[]).map((issue) => issue.path);
      assert.ok(paths.includes(field), query + " should report an issue on " + field);
    }
  });

  test("rejects an unknown criticality", async () => {
    const response = await server.get("/api/products?criticality=URGENT");
    assert.equal(response.status, 422);
    expectErrorShape(await response.json(), "VALIDATION_FAILED");
  });
});

describe("GET /api/products/:id", () => {
  test("resolves by sku and by cuid to the same record", async () => {
    const { data } = expectEnvelope<Product[]>(await server.json("/api/products?pageSize=1"));
    const seed = data[0]!;

    const bySku = expectEnvelope<Product>(await server.json("/api/products/" + seed.sku));
    const byId = expectEnvelope<Product>(await server.json("/api/products/" + seed.id));

    assert.deepEqual(bySku.data, byId.data, "both identifiers must resolve to one record");
    assert.equal(bySku.data.sku, seed.sku);
  });

  test("returns 404 for an unknown identifier", async () => {
    const response = await server.get("/api/products/NOPE");
    assert.equal(response.status, 404);

    const body = expectErrorShape(await response.json(), "NOT_FOUND");
    assert.ok(body.error.message.includes("NOPE"), "the message should name what was not found");
  });

  test("does not leak a paginated meta for a single record", async () => {
    const { meta } = expectEnvelope<Product>(await server.json("/api/products/SKU-LIS-10"));
    assert.equal(meta.page, undefined);
    assert.equal(meta.total, undefined);
  });
});

describe("GET /api/warehouses", () => {
  test("returns every warehouse with the documented fields", async () => {
    const { data } = expectEnvelope<Warehouse[]>(await server.json("/api/warehouses"));
    assert.ok(data.length > 0, "seed data is missing");

    for (const warehouse of data) {
      assert.equal(typeof warehouse.id, "string");
      assert.equal(typeof warehouse.code, "string");
      assert.equal(typeof warehouse.name, "string");
      assert.ok(["METRO", "TIER_1", "TIER_2", "TIER_3"].includes(warehouse.tier));
      assert.ok(warehouse.capacity === null || typeof warehouse.capacity === "number");
      assert.equal(typeof warehouse.isActive, "boolean");
    }
  });

  test("orders by code ascending", async () => {
    const { data } = expectEnvelope<Warehouse[]>(await server.json("/api/warehouses"));
    const codes = data.map((warehouse) => warehouse.code);
    assert.deepEqual(codes, [...codes].sort());
  });

  test("is not paginated", async () => {
    const { meta } = expectEnvelope<Warehouse[]>(await server.json("/api/warehouses"));
    assert.equal(meta.page, undefined, "the network is a fixed set of DCs");
  });

  test("filters by tier", async () => {
    const all = expectEnvelope<Warehouse[]>(await server.json("/api/warehouses"));
    const metro = expectEnvelope<Warehouse[]>(await server.json("/api/warehouses?tier=METRO"));

    assert.ok(metro.data.length > 0);
    assert.ok(metro.data.length < all.data.length, "the filter must narrow the set");
    for (const warehouse of metro.data) assert.equal(warehouse.tier, "METRO");
  });

  test("filters by region", async () => {
    const all = expectEnvelope<Warehouse[]>(await server.json("/api/warehouses"));
    const region = all.data[0]!.region;
    if (!region) return;

    const filtered = expectEnvelope<Warehouse[]>(
      await server.json("/api/warehouses?region=" + encodeURIComponent(region)),
    );
    for (const warehouse of filtered.data) assert.equal(warehouse.region, region);
  });

  test("rejects an unknown tier", async () => {
    const response = await server.get("/api/warehouses?tier=TIER_9");
    assert.equal(response.status, 422);
    expectErrorShape(await response.json(), "VALIDATION_FAILED");
  });
});
