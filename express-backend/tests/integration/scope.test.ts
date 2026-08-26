import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { startServer, type TestServer } from "../helpers/server.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import bcrypt from "bcryptjs";

let server: TestServer;

let globalAdminToken: string;
let dc1UserToken: string;
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
  ];
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
  await prisma.user.deleteMany({ where: { email: { endsWith: "@scope.test" } } });
  if (roleIds.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
  }
  if (product) await prisma.product.deleteMany({ where: { id: product.id } });
  const wIds = [warehouse1?.id, warehouse2?.id].filter(Boolean);
  if (wIds.length > 0) await prisma.warehouse.deleteMany({ where: { id: { in: wIds } } });
  await server.close();
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
