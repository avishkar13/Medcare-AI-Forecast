import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { prisma } from "../../src/config/prisma.js";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";

let server: TestServer;

const generateToken = (userId: string) => {
  const secret = (env as any).JWT_SECRET || "super_secret_jwt_key_for_development_purposes_only";
  return jwt.sign({ sub: userId }, secret, { expiresIn: "1d" });
};

const createRoleWithPermissions = async (name: string, permissionKeys: string[]) => {
  const role = await prisma.role.create({
    data: { name, description: "Test Role" }
  });

  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } }
  });

  await prisma.rolePermission.createMany({
    data: permissions.map(p => ({ roleId: role.id, permissionId: p.id }))
  });

  return role;
};

const createUserWithRole = async (email: string, roleId: string) => {
  return prisma.user.create({
    data: {
      name: "Test User",
      email,
      passwordHash: "dummy",
      roleId,
    }
  });
};

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

describe("Dynamic Authorization", () => {
  let inventoryRole: { id: string };
  let testUser: { id: string, email: string };
  let token: string;

  before(async () => {
    inventoryRole = await createRoleWithPermissions("Inventory Manager", ["inventory:view"]);
    testUser = await createUserWithRole("inv_manager@test.com", inventoryRole.id);
    token = generateToken(testUser.id);
  });

  after(async () => {
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: inventoryRole.id } });
    await prisma.role.delete({ where: { id: inventoryRole.id } });
  });

  test("allows access when user has required permission", async () => {
    // Explicitly use global fetch without interceptors if there are any
    const response = await fetch(`${server.url}/api/inventory`, {
      headers: { authorization: `Bearer ${token}` }
    });
    // Should pass authorization (might fail with 429 or return 200, but definitely not 403 or 401)
    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 403);
  });

  test("denies access when user lacks required permission", async () => {
    const response = await fetch(`${server.url}/api/alerts`, {
      headers: { authorization: `Bearer ${token}` }
    });
    // Lacks 'alerts:view'
    assert.equal(response.status, 403);
  });

  test("dynamically recognizes permission revocation", async () => {
    // Revoke 'inventory:view'
    const permission = await prisma.permission.findUnique({ where: { key: "inventory:view" } });
    if (permission) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: inventoryRole.id, permissionId: permission.id }
      });
    }

    const response = await fetch(`${server.url}/api/inventory`, {
      headers: { authorization: `Bearer ${token}` }
    });
    
    // Now it should be forbidden without re-authenticating or issuing a new JWT
    assert.equal(response.status, 403);
  });

  test("unauthenticated requests return 401", async () => {
    // Setting authorization to empty string bypasses the TestServer auto-inject
    const response = await fetch(`${server.url}/api/inventory`, {
      headers: { authorization: "" }
    });
    assert.equal(response.status, 401);
  });
});
