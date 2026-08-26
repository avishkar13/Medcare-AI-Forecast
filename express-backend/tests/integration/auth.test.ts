import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { startServer, type TestServer } from "../helpers/server.js";
import { app } from "../../src/app.js";
import { redis } from "../../src/config/redis.js";

let server: TestServer;

before(async () => {
  if (redis) await redis.flushdb();
  server = await startServer(app);
});

after(async () => {
  await server.close();
});

describe("POST /api/auth/login", () => {
  test("returns a token and user details for valid credentials", async () => {
    const response = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "system@medcare.local", password: "!" }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as any;
    assert.ok(body.data.token, "token should be present");
    assert.equal(body.data.user.email, "system@medcare.local");
    assert.equal(body.data.user.passwordHash, undefined, "password hash must not leak");
  });

  test("returns 401 for wrong password", async () => {
    const response = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "system@medcare.local", password: "wrong" }),
    });

    assert.equal(response.status, 401);
  });

  test("returns 401 for unknown email", async () => {
    const response = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@medcare.local", password: "!" }),
    });

    assert.equal(response.status, 401);
  });
});
