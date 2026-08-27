import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { app, teardown } from "../helpers/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import { startServer, type TestServer } from "../helpers/server.js";
import bcrypt from "bcryptjs";

let server: TestServer;
let adminToken: string;
let plannerToken: string;
let viewerToken: string;
let adminUser: any;
let adminRole: any;
let plannerRole: any;
let viewerRole: any;
let customRole: any;
let warehouse1: any;
let permView: any;
let permEdit: any;


before(async () => {
  if (redis) await redis.flushdb();
  server = await startServer(app);

  // Setup basic roles & users
  adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: { isSystemRole: true },
    create: { name: "ADMIN", isSystemRole: true },
  });
  plannerRole = await prisma.role.upsert({
    where: { name: "PLANNER" },
    update: { isSystemRole: true },
    create: { name: "PLANNER", isSystemRole: true },
  });
  viewerRole = await prisma.role.upsert({
    where: { name: "VIEWER" },
    update: { isSystemRole: true },
    create: { name: "VIEWER", isSystemRole: true },
  });

  warehouse1 = await prisma.warehouse.create({
    data: { code: "ADMIN_TEST_W1", name: "Admin Test W1", region: "NA", tier: "TIER_1", isActive: true },
  });

  const pwd = await bcrypt.hash("password123", 10);

  adminUser = await prisma.user.create({
    data: { email: "admin@admin-rbac.test", passwordHash: pwd, name: "Admin", roleId: adminRole.id, warehouseId: null, isActive: true }
  });

  await prisma.user.create({
    data: { email: "planner@admin-rbac.test", passwordHash: pwd, name: "Planner", roleId: plannerRole.id, warehouseId: warehouse1.id, isActive: true }
  });

  await prisma.user.create({
    data: { email: "viewer@admin-rbac.test", passwordHash: pwd, name: "Viewer", roleId: viewerRole.id, warehouseId: warehouse1.id, isActive: true }
  });

  const login = async (email: string) => {
    const res = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    const body = (await res.json()) as any;
    return body.data.token;
  };

  adminToken = await login("admin@admin-rbac.test");
  plannerToken = await login("planner@admin-rbac.test");
  viewerToken = await login("viewer@admin-rbac.test");

  permView = await prisma.permission.upsert({
    where: { key: "inventory:view" },
    update: {},
    create: { key: "inventory:view", name: "Inventory View", module: "inventory", action: "view" },
  });
  permEdit = await prisma.permission.upsert({
    where: { key: "inventory:edit" },
    update: {},
    create: { key: "inventory:edit", name: "Inventory Edit", module: "inventory", action: "edit" },
  });

  // Assign roles:view, roles:create, roles:edit, roles:delete, users:view, users:create, users:edit, users:deactivate
  const adminPerms = ["roles:view", "roles:create", "roles:edit", "roles:delete", "users:view", "users:create", "users:edit", "users:deactivate"];
  for (const p of adminPerms) {
    const perm = await prisma.permission.upsert({
      where: { key: p },
      update: {},
      create: { key: p, name: p, module: p.split(":")[0] as string, action: p.split(":")[1] as string },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }
});

after(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@admin-rbac.test" } } });
  await prisma.rolePermission.deleteMany({ where: { role: { name: { startsWith: "CUSTOM_ROLE" } } } });
  await prisma.role.deleteMany({ where: { name: { startsWith: "CUSTOM_ROLE" } } });
  await prisma.warehouse.deleteMany({ where: { code: "ADMIN_TEST_W1" } });
  await server.close();
  await teardown();
});

describe("Admin Role Management", () => {
  test("ADMIN can list roles", async () => {
    const res = await fetch(`${server.url}/api/admin/roles`, {
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(body.data.length >= 3);
  });

  test("PLANNER and VIEWER cannot list roles (Non-admin cannot access any admin endpoint)", async () => {
    const res1 = await fetch(`${server.url}/api/admin/roles`, {
      headers: { "Authorization": `Bearer ${plannerToken}` },
    });
    assert.equal(res1.status, 403);
    
    const res2 = await fetch(`${server.url}/api/admin/roles`, {
      headers: { "Authorization": `Bearer ${viewerToken}` },
    });
    assert.equal(res2.status, 403);
  });

  test("ADMIN can create custom role", async () => {
    const res = await fetch(`${server.url}/api/admin/roles`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "CUSTOM_ROLE_1", description: "Test custom role" }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.data.name, "CUSTOM_ROLE_1");
    assert.equal(body.data.isSystemRole, false);
    customRole = body.data;
  });

  test("Duplicate role name is rejected", async () => {
    const res = await fetch(`${server.url}/api/admin/roles`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "CUSTOM_ROLE_1" }),
    });
    assert.equal(res.status, 409);
  });

  test("Cannot delete/protect system roles", async () => {
    const res = await fetch(`${server.url}/api/admin/roles/${adminRole.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 403);
  });
  
  test("Cannot rename system roles", async () => {
    const res = await fetch(`${server.url}/api/admin/roles/${adminRole.id}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "SUPER_ADMIN" }),
    });
    assert.equal(res.status, 403);
  });

  test("ADMIN can list permissions", async () => {
    const res = await fetch(`${server.url}/api/admin/roles/permissions`, {
      headers: { "Authorization": `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(body.data.length > 0);
  });

  test("ADMIN can assign permissions to a role", async () => {
    const res = await fetch(`${server.url}/api/admin/roles/${customRole.id}/permissions`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ permissionIds: [permView.id, permEdit.id] }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.data.permissions.length, 2);
  });

  test("Permission assignment is immediately reflected in authorization without JWT regeneration", async () => {
    // Create a user with CUSTOM_ROLE_1
    await prisma.user.create({
      data: { email: "custom@admin-rbac.test", passwordHash: await bcrypt.hash("password123", 10), name: "Custom", roleId: customRole.id, warehouseId: warehouse1.id, isActive: true }
    });
    
    const resLogin = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "custom@admin-rbac.test", password: "password123" }),
    });
    const customToken = ((await resLogin.json()) as any).data.token;
    
    // Test access to something requiring inventory:view
    // We haven't created a dedicated test endpoint for inventory:view here, but we can test
    // that the token works for a route that requires inventory:view.
    const res = await fetch(`${server.url}/api/warehouses`, {
      headers: { "Authorization": `Bearer ${customToken}` },
    });
    assert.equal(res.status, 200); // They have inventory:view

    // ADMIN removes inventory:view
    await fetch(`${server.url}/api/admin/roles/${customRole.id}/permissions/${permView.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` },
    });

    // Test access again (using SAME token)
    const res2 = await fetch(`${server.url}/api/warehouses`, {
      headers: { "Authorization": `Bearer ${customToken}` },
    });
    assert.equal(res2.status, 403); // Permission revocation is immediately reflected
  });
});

describe("Admin User Management", () => {
  let createdUser: any;

  test("ADMIN can create a user, password hashed, hash never returned", async () => {
    const res = await fetch(`${server.url}/api/admin/users`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "test.create@admin-rbac.test",
        password: "testpassword",
        roleId: plannerRole.id,
        warehouseId: warehouse1.id,
      }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    createdUser = body.data;
    assert.equal(createdUser.email, "test.create@admin-rbac.test");
    assert.equal(createdUser.passwordHash, undefined); // Never return hash
    
    // Check DB for hash
    const dbUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
    assert.ok(dbUser?.passwordHash.startsWith("$2a$") || dbUser?.passwordHash.startsWith("$2b$"));
    assert.notEqual(dbUser?.passwordHash, "testpassword");
  });

  test("Duplicate email is rejected", async () => {
    const res = await fetch(`${server.url}/api/admin/users`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User 2",
        email: "test.create@admin-rbac.test", // Same email
        password: "testpassword",
        roleId: plannerRole.id,
      }),
    });
    assert.equal(res.status, 409);
  });

  test("Invalid role ID is rejected", async () => {
    const res = await fetch(`${server.url}/api/admin/users`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User 3",
        email: "test.invalid@admin-rbac.test",
        password: "testpassword",
        roleId: "non_existent_role_id",
      }),
    });
    assert.equal(res.status, 404);
  });
  
  test("Invalid warehouse ID is rejected", async () => {
    const res = await fetch(`${server.url}/api/admin/users`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User 3",
        email: "test.invalid2@admin-rbac.test",
        password: "testpassword",
        roleId: plannerRole.id,
        warehouseId: "non_existent_warehouse_id"
      }),
    });
    assert.equal(res.status, 404);
  });

  test("ADMIN can change user role and warehouse", async () => {
    const res = await fetch(`${server.url}/api/admin/users/${createdUser.id}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        roleId: customRole.id,
        warehouseId: null, // removing warehouse
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.data.roleId, customRole.id);
    assert.equal(body.data.warehouseId, null);
  });

  test("ADMIN can deactivate user", async () => {
    const res = await fetch(`${server.url}/api/admin/users/${createdUser.id}/status`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.data.isActive, false);
  });

  test("Deactivated user cannot login", async () => {
    const res = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test.create@admin-rbac.test",
        password: "testpassword",
      }),
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as any;
    assert.match(body.error.message, /deactivated/i);
  });

  test("Deactivated user cannot use existing valid JWT", async () => {
    // Just grab a fresh token before deactivating (actually, the user is already deactivated above!)
    // Oh wait, `createdUser` was deactivated in the previous test. We need a token for it.
    // Wait, since we can't login, we should have generated the token BEFORE deactivating it.
    // So let's reset it to active, get a token, deactivate it, then use the token.
    await prisma.user.update({ where: { id: createdUser.id }, data: { isActive: true } });
    
    const resLogin = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test.create@admin-rbac.test", password: "testpassword" }),
    });
    const token = ((await resLogin.json()) as any).data.token;

    // Deactivate it again
    await prisma.user.update({ where: { id: createdUser.id }, data: { isActive: false } });

    const res = await fetch(`${server.url}/api/admin/roles`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    assert.equal(res.status, 401); // Unauthorized, NOT Forbidden, because authenticate.ts blocks it
  });

  test("Cannot remove the last ADMIN protection", async () => {
    // Temporarily deactivate any other admins in the DB so this test can reliably hit the limit
    const otherAdmins = await prisma.user.findMany({
      where: { role: { name: "ADMIN" }, isActive: true, id: { not: adminUser.id } }
    });
    if (otherAdmins.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherAdmins.map(u => u.id) } },
        data: { isActive: false }
      });
    }

    // Attempt to deactivate the only admin
    const res = await fetch(`${server.url}/api/admin/users/${adminUser.id}/status`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    assert.equal(res.status, 403);
    
    // Attempt to change role of the only admin
    const res2 = await fetch(`${server.url}/api/admin/users/${adminUser.id}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ roleId: viewerRole.id }),
    });
    assert.equal(res2.status, 403);

    // Restore other admins
    if (otherAdmins.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherAdmins.map(u => u.id) } },
        data: { isActive: true }
      });
    }
  });
});
