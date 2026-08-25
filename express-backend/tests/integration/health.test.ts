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
  dependencies: { database: string; redis: string; forecast: string };
}

describe("GET /", () => {
  test("answers that the service is working and says where the API lives", async () => {
    const response = await server.get("/");
    assert.equal(response.status, 200);

    const body = (await response.json()) as { status: string; api: string };
    assert.equal(body.status, "working");
    assert.ok(body.api.startsWith("/"), `api prefix is not a path: ${body.api}`);
  });

  test("the advertised prefix is the one that actually serves routes", async () => {
    const { api } = (await server.json("/")) as { api: string };
    const response = await server.get(`${api}/health/live`);
    assert.equal(response.status, 200, `${api} does not serve the health probe`);
  });
});

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
    for (const dependency of Object.values(body.dependencies)) {
      assert.ok(["up", "down", "not_configured"].includes(dependency));
    }
  });

  test("status agrees with the dependency states", async () => {
    const response = await server.get("/api/health/ready");
    const body = (await response.json()) as Readiness;
    // The forecast engine is deliberately excluded: with the fallback enabled a
    // dead engine does not take the instance out of rotation.
    const degraded = [body.dependencies.database, body.dependencies.redis].includes("down");

    assert.equal(body.status, degraded ? "degraded" : "ok");
    assert.equal(response.status, degraded ? 503 : 200, "a degraded instance must not stay in rotation");
  });

  test("an absent forecast engine is not configured, not down", async () => {
    const body = (await server.json("/api/health/ready")) as Readiness;
    assert.ok(["up", "down", "not_configured"].includes(body.dependencies.forecast));

    if (body.dependencies.forecast === "not_configured") {
      assert.notEqual(body.status, "degraded", "no engine configured is not a fault");
    }
  });

  test("a dead engine does not take the instance out of rotation", async () => {
    const body = (await server.json("/api/health/ready")) as Readiness;

    if (body.dependencies.forecast === "down" && body.dependencies.database === "up") {
      assert.notEqual(
        body.status,
        "degraded",
        "the naive fallback still produces plans, so the instance is still ready",
      );
    }
  });

  test("an unconfigured Redis does not degrade readiness", async () => {
    const body = (await server.json("/api/health/ready")) as Readiness;
    if (body.dependencies.redis === "not_configured") {
      assert.notEqual(body.status, "degraded", "absent by design is not the same as broken");
    }
  });
});
