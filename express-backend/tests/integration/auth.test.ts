import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { startServer, type TestServer } from "../helpers/server.js";
import { app, teardown } from "../helpers/app.js";
import { redis } from "../../src/config/redis.js";

let server: TestServer;

before(async () => {
  if (redis) await redis.flushdb();
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

/** The one seeded account with a real bcrypt hash; see `prisma/seed.ts`. */
const ADMIN_EMAIL = "jhaaniket2005@gmail.com";
const ADMIN_PASSWORD = "Anik@1234";

describe("POST /api/auth/login", () => {
  /**
   * Signs in as the account the seed creates for signing in as.
   *
   * This used to use `system@medcare.local` with password `"!"`, which could never
   * succeed. `seed.ts` says so itself: SYSTEM, PLANNER and VIEWER "share a placeholder
   * hash of '!' ... fine for an actor id on a row but cannot be typed into the login
   * form". On the shared database that row still stores the literal `"!"` rather than
   * a bcrypt hash, so `compare` cannot match it under any circumstances - the test was
   * asserting the opposite of what the seed intends, and was permanently red.
   */
  test("returns a token and user details for valid credentials", async () => {
    const response = await fetch(`${server.url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as any;
    assert.ok(body.data.token, "token should be present");
    assert.equal(body.data.user.email, ADMIN_EMAIL);
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
