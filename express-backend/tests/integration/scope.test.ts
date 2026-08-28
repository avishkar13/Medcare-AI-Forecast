import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { startServer, type TestServer } from "../helpers/server.js";
import { app, teardown } from "../helpers/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import bcrypt from "bcryptjs";

let server: TestServer;

let globalAdminToken: string;
let dc1UserToken: string;
let dc1ControllerToken: string;
let dc2UserToken: string;

let warehouse1: { id: string; code: string };
let warehouse2: { id: string; code: string };
let product: { id: string; sku: string };
let roleIds: string[] = [];

before(async () => {
  if (redis) await redis.flushdb();
  server = await startServer(app);

  // 1. Create two test warehouses
  warehouse1 = await prisma.warehouse.create({
    data: { code: "SCOPE_W1", name: "Scope Warehouse 1", region: "NA", tier: "TIER_1", isActive: true },
  });
  warehouse2 = await prisma.warehouse.create({
    data: { code: "SCOPE_W2", name: "Scope Warehouse 2", region: "NA", tier: "TIER_2", isActive: true },
  });

  // 2. Create a test product
  product = await prisma.product.create({
    data: { sku: "SCOPE_P1", name: "Scope Product 1", category: "tablets", unit: "pack", unitCost: 10, shelfLifeDays: 365, criticality: "HIGH", isActive: true },
  });

  const perms = [
    { key: "dashboard:view", name: "Dashboard Read", module: "dashboard", action: "view" },
    { key: "forecast:view", name: "Forecast Read", module: "forecast", action: "view" },
    { key: "inventory:view", name: "Inventory Read", module: "inventory", action: "view" },
    { key: "alerts:view", name: "Alerts Read", module: "alerts", action: "view" },
    { key: "expiry:view", name: "Expiry Read", module: "expiry", action: "view" },
  ];
  // Deliberately not added to the two roles above: an existing test asserting a 403
  // for a missing permission must keep asserting the same thing.
  const adjustPerm =
    (await prisma.permission.findUnique({ where: { key: "inventory:adjust" } })) ??
    (await prisma.permission.create({
      data: { key: "inventory:adjust", name: "Inventory Adjust", module: "inventory", action: "adjust" },
    }));
  const createdPerms = [];
  for (const p of perms) {
    let perm = await prisma.permission.findUnique({ where: { key: p.key } });
    if (!perm) perm = await prisma.permission.create({ data: p });
    createdPerms.push(perm);
  }

  const viewRole = await prisma.role.create({ data: { name: "SCOPE_VIEWER", description: "Viewer" } });
  roleIds.push(viewRole.id);
  await prisma.rolePermission.createMany({
    data: createdPerms.map(p => ({ roleId: viewRole.id, permissionId: p.id }))
  });

  const adminRole = await prisma.role.create({ data: { name: "SCOPE_ADMIN", description: "Admin" } });
  roleIds.push(adminRole.id);
  await prisma.rolePermission.createMany({
    data: createdPerms.map(p => ({ roleId: adminRole.id, permissionId: p.id }))
  });

  // 4. Create Users
  const pwd = await bcrypt.hash("password123", 10);

  const globalAdmin = await prisma.user.create({
    data: {
      email: "global_admin@scope.test",
      passwordHash: pwd,
      name: "Global Admin",
      warehouseId: null, // Global access
      roleId: adminRole.id
    }
  });

  const dc1User = await prisma.user.create({
    data: {
      email: "dc1_user@scope.test",
      passwordHash: pwd,
      name: "DC1 User",
      warehouseId: warehouse1.id, // Scoped to W1
      roleId: viewRole.id
    }
  });

  const dc2User = await prisma.user.create({
    data: {
      email: "dc2_user@scope.test",
      passwordHash: pwd,
      name: "DC2 User",
      warehouseId: warehouse2.id, // Scoped to W2
      roleId: viewRole.id
    }
  });

  // 5. Login to get tokens
  const login = async (email: string) => {
    const res = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    const body = (await res.json()) as any;
    return body.data.token;
  };

  globalAdminToken = await login(globalAdmin.email);
  dc1UserToken = await login(dc1User.email);
  dc2UserToken = await login(dc2User.email);

  // A stock controller confined to W1: holds `inventory:adjust`, so a refusal can only
  // come from DC scope and never from a missing permission.
  const controllerRole = await prisma.role.create({
    data: { name: "SCOPE_STOCK_CONTROLLER", description: "Confined stock controller" },
  });
  roleIds.push(controllerRole.id);
  await prisma.rolePermission.createMany({
    data: [...createdPerms, adjustPerm].map((p) => ({
      roleId: controllerRole.id,
      permissionId: p.id,
    })),
  });

  const dc1Controller = await prisma.user.create({
    data: {
      email: "dc1_controller@scope.test",
      passwordHash: pwd,
      name: "DC1 Controller",
      warehouseId: warehouse1.id,
      roleId: controllerRole.id,
    },
  });
  dc1ControllerToken = await login(dc1Controller.email);

  // 6. Seed some test inventory positions to test filters
  await prisma.inventory.create({
    data: {
      productId: product.id,
      warehouseId: warehouse1.id,
      onHand: 100,
      reserved: 0,
      inTransit: 0
    }
  });

  await prisma.inventory.create({
    data: {
      productId: product.id,
      warehouseId: warehouse2.id,
      onHand: 200,
      reserved: 0,
      inTransit: 0
    }
  });
});

after(async () => {
  // Cleanup
  if (product) await prisma.inventory.deleteMany({ where: { productId: product.id } });
  // Before the users: a restock request holds FKs to both the requester and the
  // product, so deleting either first fails the constraint.
  if (product) await prisma.restockRequest.deleteMany({ where: { productId: product.id } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@scope.test" } } });
  if (roleIds.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
  }
  if (product) await prisma.product.deleteMany({ where: { id: product.id } });
  const wIds = [warehouse1?.id, warehouse2?.id].filter(Boolean);
  if (wIds.length > 0) await prisma.warehouse.deleteMany({ where: { id: { in: wIds } } });
  await server.close();
  // Every other suite does this. Without it the Prisma and Redis handles stay open,
  // the event loop never drains, and the file hangs after its last assertion passes.
  await teardown();
});

describe("Global Admin (No Warehouse Scope)", () => {
  test("can access dashboard data without specifying warehouse (gets everything)", async () => {
    const res = await fetch(`${server.url}/api/dashboard/network`, {
      headers: { "Authorization": `Bearer ${globalAdminToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(body.data.length >= 2);
  });

  test("can explicitly request data for warehouse1", async () => {
    const res = await fetch(`${server.url}/api/dashboard/inventory-health?warehouseId=${warehouse1.id}`, {
      headers: { "Authorization": `Bearer ${globalAdminToken}` },
    });
    assert.equal(res.status, 200);
  });
});

describe("DC1 User (Scoped to Warehouse 1)", () => {
  test("can access dashboard data without specifying warehouse (gets ONLY warehouse1)", async () => {
    const res = await fetch(`${server.url}/api/dashboard/network`, {
      headers: { "Authorization": `Bearer ${dc1UserToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, warehouse1.id);
    
    // Check masterdata warehouses list is also scoped!
    const mdRes = await fetch(`${server.url}/api/warehouses`, {
      headers: { "Authorization": `Bearer ${dc1UserToken}` },
    });
    assert.equal(mdRes.status, 200);
    const mdBody = (await mdRes.json()) as any;
    assert.equal(mdBody.data.length, 1);
    assert.equal(mdBody.data[0].id, warehouse1.id);
  });

  test("can explicitly request data for their own warehouse (warehouse1)", async () => {
    const res = await fetch(`${server.url}/api/dashboard/inventory-health?warehouseId=${warehouse1.id}`, {
      headers: { "Authorization": `Bearer ${dc1UserToken}` },
    });
    assert.equal(res.status, 200);
  });

  test("is FORBIDDEN from requesting data for warehouse2 (Conflict/Forbidden)", async () => {
    const res = await fetch(`${server.url}/api/dashboard/inventory-health?warehouseId=${warehouse2.id}`, {
      headers: { "Authorization": `Bearer ${dc1UserToken}` },
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.equal(body.error.code, "FORBIDDEN");
  });
});

describe("DC2 User (Scoped to Warehouse 2)", () => {
  test("is FORBIDDEN from requesting data for warehouse1 in other services like masterdata", async () => {
    const res = await fetch(`${server.url}/api/warehouses/${warehouse1.id}`, {
      headers: { "Authorization": `Bearer ${dc2UserToken}` },
    });
    assert.equal(res.status, 403);
  });

  test("can request their own warehouse masterdata", async () => {
    const res = await fetch(`${server.url}/api/warehouses/${warehouse2.id}`, {
      headers: { "Authorization": `Bearer ${dc2UserToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.data.id, warehouse2.id);
  });
});

/**
 * Phase 2.1 / 2.4 - the routes that were reachable network-wide by a confined caller.
 *
 * Assertions are about the *relationship* between two responses, never a seeded
 * figure: the seed computes expiry dates relative to today, so a pinned number passes
 * once and fails tomorrow.
 */
describe("Phase 2 - scope on the routes that lacked it", () => {
  const get = (path: string, token: string) =>
    fetch(`${server.url}${path}`, { headers: { Authorization: `Bearer ${token}` } });

  test("summary takes an explicit warehouseId, and a confined caller cannot widen", async () => {
    const own = await get(`/api/dashboard/summary?warehouseId=${warehouse1.id}`, dc1UserToken);
    assert.equal(own.status, 200);

    const other = await get(`/api/dashboard/summary?warehouseId=${warehouse2.id}`, dc1UserToken);
    assert.equal(
      other.status,
      403,
      "a confined caller asking for another DC must be refused, not quietly filtered",
    );
    assert.equal(((await other.json()) as any).error.code, "FORBIDDEN");
  });

  test("summary scoped to one DC never exceeds the network figure", async () => {
    const [wide, narrow] = await Promise.all([
      get("/api/dashboard/summary", globalAdminToken),
      get(`/api/dashboard/summary?warehouseId=${warehouse1.id}`, globalAdminToken),
    ]);
    assert.equal(wide.status, 200);
    assert.equal(narrow.status, 200);

    const all = ((await wide.json()) as any).data.kpis;
    const one = ((await narrow.json()) as any).data.kpis;

    // pendingRecommendations and forecastAccuracy used to ignore scope entirely, so a
    // DC row carried network-wide figures beside DC-wide stock.
    assert.ok(one.pendingRecommendations <= all.pendingRecommendations);
    assert.ok(one.skusMonitored <= all.skusMonitored);
    assert.ok(one.totalInventoryValue <= all.totalInventoryValue + 1e-6);
  });

  test("network accepts warehouseId and refuses another DC", async () => {
    const own = await get(`/api/dashboard/network?warehouseId=${warehouse1.id}`, globalAdminToken);
    assert.equal(own.status, 200);
    const rows = ((await own.json()) as any).data;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, warehouse1.id);

    const other = await get(`/api/dashboard/network?warehouseId=${warehouse1.id}`, dc2UserToken);
    assert.equal(other.status, 403);
  });

  test("forecast accuracy is scoped - it was answered network-wide for everyone", async () => {
    const own = await get(`/api/forecast/accuracy?warehouse=${warehouse1.code}`, dc1UserToken);
    assert.equal(own.status, 200);

    const other = await get(`/api/forecast/accuracy?warehouse=${warehouse2.code}`, dc1UserToken);
    assert.equal(other.status, 403, "?warehouse= used to win over the caller's own assignment");
  });

  test("alerts guard the id, so filtering by a display name still works", async () => {
    // `location` is a display name and never equals a warehouse id. Guarding it 403d a
    // confined caller filtering by the name of their own DC.
    const byName = await get(`/api/alerts?location=${encodeURIComponent("Scope Warehouse 1")}`, dc1UserToken);
    assert.equal(byName.status, 200);

    const other = await get(`/api/alerts?warehouseId=${warehouse2.id}`, dc1UserToken);
    assert.equal(
      other.status,
      403,
      "another DC's id must be refused, not answered with an empty list",
    );
  });

  test("a confined caller cannot decide another DC's restock request", async () => {
    // `create` and `list` narrowed by the caller's DC and approve/reject did not, so a
    // planner confined to W1 could approve stock for W2 - a site they cannot even see.
    const patch = (path: string, token: string) =>
      fetch(`${server.url}${path}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

    // Both rows are seeded directly: this asserts on the *decide* endpoint, and going
    // through POST would only add a second permission's worth of setup to get there.
    const [foreign, own] = await Promise.all([
      prisma.restockRequest.create({
        data: { productId: product.id, warehouseId: warehouse2.id, quantity: 25 },
        select: { id: true },
      }),
      prisma.restockRequest.create({
        data: { productId: product.id, warehouseId: warehouse1.id, quantity: 25 },
        select: { id: true },
      }),
    ]);

    const refused = await patch(`/api/restock-requests/${foreign.id}/approve`, dc1ControllerToken);
    assert.equal(
      refused.status,
      404,
      "another DC's request must not be decidable by a confined caller",
    );

    // Still REQUESTED: the refusal has to prevent the write, not merely report one.
    const after = await prisma.restockRequest.findUniqueOrThrow({
      where: { id: foreign.id },
      select: { status: true },
    });
    assert.equal(after.status, "REQUESTED");

    const allowed = await patch(`/api/restock-requests/${own.id}/approve`, dc1ControllerToken);
    assert.equal(allowed.status, 200, "their own DC's request must still be decidable");
  });

  test("an unknown warehouseId is a 404, not a silently empty network", async () => {
    // An empty body reads as "this DC holds nothing" and hides the typo. `/expiry-risk`
    // and `/alerts` already answered 404; summary and network did not.
    for (const path of ["/api/dashboard/summary", "/api/dashboard/network"]) {
      const res = await get(`${path}?warehouseId=NOT_A_REAL_ID`, globalAdminToken);
      assert.equal(res.status, 404, `${path} must reject an unknown warehouse`);
      assert.equal(((await res.json()) as any).error.code, "NOT_FOUND");
    }
  });

  test("waste prevention is scoped rather than network-wide", async () => {
    const own = await get(`/api/expiry/waste-prevention?warehouse=${warehouse1.code}`, dc1UserToken);
    assert.equal(own.status, 200);

    const other = await get(`/api/expiry/waste-prevention?warehouse=${warehouse2.code}`, dc1UserToken);
    assert.equal(other.status, 403);
  });
});
