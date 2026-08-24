import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

process.env.RATE_LIMIT_ENABLED = "true";
process.env.RATE_LIMIT_READ_MAX = "3";
process.env.RATE_LIMIT_GLOBAL_MAX = "50";
process.env.RATE_LIMIT_PREFIX = "test-" + randomUUID();

const { app } = await import("../../src/app.js");
const { disconnectPrisma } = await import("../../src/config/prisma.js");
const { disconnectRedis } = await import("../../src/config/redis.js");

const { startServer } = await import("../helpers/server.js");
const { expectErrorShape } = await import("../helpers/assertions.js");

let server: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
});

describe("rate limiting", () => {
  test("a read route starts refusing once its tier is exhausted", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await server.get("/api/warehouses")).status);
    }

    assert.ok(statuses.includes(429), "expected a 429 after exceeding the limit, got " + statuses.join(","));
    assert.equal(statuses[0], 200, "the first request must succeed");
    assert.equal(statuses.at(-1), 429, "once exhausted, the tier stays closed for the window");
  });

  test("a refusal uses the standard error contract", async () => {
    let response = await server.get("/api/products");
    for (let attempt = 0; attempt < 8 && response.status !== 429; attempt += 1) {
      response = await server.get("/api/products");
    }

    assert.equal(response.status, 429);
    const body = expectErrorShape(await response.json(), "RATE_LIMIT_EXCEEDED");
    assert.ok(body.error.requestId, "a throttled response still needs to be traceable");

    const details = body.error.details as { retryAfterSeconds: number };
    assert.equal(typeof details.retryAfterSeconds, "number");
    assert.ok(details.retryAfterSeconds >= 1, "a retry delay of zero would invite an immediate retry");
  });

  test("a refusal tells the client when to come back", async () => {
    let response = await server.get("/api/products");
    for (let attempt = 0; attempt < 8 && response.status !== 429; attempt += 1) {
      response = await server.get("/api/products");
    }

    assert.equal(response.status, 429);

    const retryAfter = Number(response.headers.get("retry-after"));
    assert.ok(Number.isFinite(retryAfter) && retryAfter >= 1, "Retry-After must be a positive number of seconds");
    assert.ok(
      retryAfter <= 60,
      "Retry-After should reflect the real reset time, not the whole window: got " + retryAfter,
    );
  });

  test("responses advertise both tiers under the draft-8 headers", async () => {
    const response = await server.get("/api/warehouses");
    const policy = response.headers.get("ratelimit-policy") ?? "";
    const limit = response.headers.get("ratelimit") ?? "";

    assert.ok(policy.includes("global"), "expected the global tier in RateLimit-Policy, got: " + policy);
    assert.ok(policy.includes("read"), "expected the read tier in RateLimit-Policy, got: " + policy);
    assert.ok(limit.length > 0, "expected a RateLimit header");
  });

  test("health probes are exempt from the global tier, so they carry no policy", async () => {
    const response = await server.get("/api/health/live");
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("ratelimit-policy"),
      null,
      "a skipped limiter must not advertise a budget it is not enforcing",
    );
  });

  test("the liveness probe is never throttled", async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await server.get("/api/health/live");
      assert.equal(
        response.status,
        200,
        "throttling a probe would make an orchestrator restart a healthy instance",
      );
    }
  });

  test("tiers count independently of one another", async () => {
    const response = await server.get("/api/warehouses");
    const header = response.headers.get("ratelimit") ?? "";
    assert.ok(header.length > 0, "expected a RateLimit header");

    const quotas = [...(response.headers.get("ratelimit-policy") ?? "").matchAll(/q=(\d+)/g)].map((match) =>
      Number(match[1]),
    );
    assert.equal(quotas.length, 2, "expected a quota for each of the two tiers");
    assert.notEqual(quotas[0], quotas[1], "the global and read tiers have different budgets");
  });
});
