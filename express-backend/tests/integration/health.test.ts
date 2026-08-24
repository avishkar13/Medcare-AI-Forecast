import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";

let server: TestServer;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

interface Readiness {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  dependencies: { database: string; redis: string };
}

describe("GET /api/health/live", () => {
  test("answers 200 with a bare payload", async () => {
    const response = await server.get("/api/health/live");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });

  test("is deliberately outside the data envelope, for orchestrator probes", async () => {
    const body = (await server.json("/api/health/live")) as Record<string, unknown>;
    assert.ok(!("data" in body), "probes must not be forced to unwrap");
    assert.ok(!("meta" in body));
  });

  test("still carries a request id", async () => {
    const response = await server.get("/api/health/live");
    assert.ok(response.headers.get("x-request-id"));
  });
});

describe("GET /api/health/ready", () => {
  test("reports each dependency by name", async () => {
    const body = (await server.json("/api/health/ready")) as Readiness;
    assert.ok(["ok", "degraded"].includes(body.status));
    assert.equal(typeof body.uptimeSeconds, "number");
    assert.ok(body.uptimeSeconds >= 0);
    for (const dependency of [body.dependencies.database, body.dependencies.redis]) {
      assert.ok(["up", "down", "not_configured"].includes(dependency));
    }
  });

  test("status agrees with the dependency states", async () => {
    const response = await server.get("/api/health/ready");
    const body = (await response.json()) as Readiness;
    const degraded = Object.values(body.dependencies).includes("down");

    assert.equal(body.status, degraded ? "degraded" : "ok");
    assert.equal(response.status, degraded ? 503 : 200, "a degraded instance must not stay in rotation");
  });

  test("an unconfigured Redis does not degrade readiness", async () => {
    const body = (await server.json("/api/health/ready")) as Readiness;
    if (body.dependencies.redis === "not_configured") {
      assert.notEqual(body.status, "degraded", "absent by design is not the same as broken");
    }
  });
});
