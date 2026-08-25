import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectErrorShape, expectSortedBy, isIsoDate } from "../helpers/assertions.js";
import { prisma } from "../../src/config/prisma.js";
import type { ScenarioSummary } from "../../src/types.js";

let server: TestServer;

// The seed creates a flu-surge scenario, so nothing here may assume an empty table.
const created: string[] = [];

const uniqueName = (label: string) => `test-${label}-${randomUUID().slice(0, 8)}`;

const createScenario = async (body?: unknown) => {
  const response = await server.post("/api/scenarios", body);
  const payload = await response.json();
  const id = (payload as { data?: { id?: string } }).data?.id;
  if (id) created.push(id);
  return { response, body: payload };
};

before(async () => {
  server = await startServer(app);
});

after(async () => {
  // Scenarios are referenced by planning runs, so drop the runs first.
  for (const id of created) {
    await prisma.planningRun.deleteMany({ where: { scenarioId: id } });
    await prisma.scenario.deleteMany({ where: { id } });
  }
  await server.close();
  await teardown();
});

describe("POST /api/scenarios", () => {
  test("creates a scenario and answers 201", async () => {
    const name = uniqueName("surge");
    const { response, body } = await createScenario({
      name,
      description: "flu season, 60% above baseline",
      demandMultiplier: 1.6,
      serviceLevelTarget: 0.98,
    });

    assert.equal(response.status, 201);
    const { data } = expectEnvelope<ScenarioSummary>(body);
    assert.equal(data.name, name);
    assert.equal(data.demandMultiplier, 1.6);
    assert.equal(data.serviceLevelTarget, 0.98);
    assert.ok(isIsoDate(data.createdAt));
    assert.equal(data.planningRunCount, 0, "a new scenario has been run zero times");
    assert.equal(response.headers.get("location"), "/api/scenarios/" + data.id);
  });

  test("unset multipliers default to neutral, matching a baseline run", async () => {
    const { body } = await createScenario({ name: uniqueName("bare") });
    const { data } = expectEnvelope<ScenarioSummary>(body);

    assert.equal(data.demandMultiplier, 1);
    assert.equal(data.leadTimeMultiplier, 1);
    assert.equal(data.capacityMultiplier, 1);
    assert.equal(data.serviceLevelTarget, 0.95);
    assert.equal(data.description, null);
  });

  test("rejects multipliers outside the documented band", async () => {
    for (const demandMultiplier of [0, 0.05, 5.1, -1]) {
      const { response } = await createScenario({ name: uniqueName("bad"), demandMultiplier });
      assert.equal(response.status, 422, "demandMultiplier=" + demandMultiplier + " should be rejected");
    }
  });

  test("rejects a service level that is not a probability", async () => {
    for (const serviceLevelTarget of [0.4, 1, 1.5]) {
      const { response } = await createScenario({ name: uniqueName("sl"), serviceLevelTarget });
      assert.equal(response.status, 422, "serviceLevelTarget=" + serviceLevelTarget + " should be rejected");
    }
  });

  test("requires a name", async () => {
    const { response, body } = await createScenario({ demandMultiplier: 1.2 });
    assert.equal(response.status, 422);
    expectErrorShape(body, "VALIDATION_FAILED");
  });

  test("rejects an unknown field rather than silently dropping it", async () => {
    const { response } = await createScenario({
      name: uniqueName("typo"),
      demandMultipler: 1.6,
    });
    assert.equal(response.status, 422, "a misspelled multiplier must not create a neutral scenario");
  });
});

describe("GET /api/scenarios", () => {
  test("returns a paginated envelope", async () => {
    await createScenario({ name: uniqueName("list") });

    const body = await server.json<unknown>("/api/scenarios");
    const { data, meta } = expectEnvelope<ScenarioSummary[]>(body);

    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0, "the seed alone guarantees at least one scenario");
    assert.equal(meta.page, 1);
    assert.equal(meta.pageSize, 20);
    assert.ok(typeof meta.total === "number" && meta.total >= data.length);
  });

  test("lists newest first", async () => {
    await createScenario({ name: uniqueName("newest") });
    const body = await server.json<unknown>("/api/scenarios?pageSize=50");
    const { data } = expectEnvelope<ScenarioSummary[]>(body);
    expectSortedBy(data, (scenario) => new Date(scenario.createdAt).getTime(), "desc");
  });

  test("filters by name, case-insensitively", async () => {
    const name = uniqueName("Findable");
    await createScenario({ name });

    const body = await server.json<unknown>("/api/scenarios?search=" + name.toUpperCase());
    const { data } = expectEnvelope<ScenarioSummary[]>(body);

    assert.equal(data.length, 1);
    assert.equal(data[0]?.name, name);
  });

  test("caps pageSize", async () => {
    const response = await server.get("/api/scenarios?pageSize=5000");
    assert.equal(response.status, 422);
  });
});

describe("GET /api/scenarios/:id", () => {
  test("returns the scenario it created", async () => {
    const { body: createdBody } = await createScenario({ name: uniqueName("one"), leadTimeMultiplier: 2 });
    const { data: made } = expectEnvelope<ScenarioSummary>(createdBody);

    const { data } = expectEnvelope<ScenarioSummary>(await server.json("/api/scenarios/" + made.id));
    assert.deepEqual(data, made, "the read must agree with what the write returned");
  });

  test("404s on an unknown id", async () => {
    const response = await server.get("/api/scenarios/does-not-exist");
    assert.equal(response.status, 404);
    expectErrorShape(await response.json(), "NOT_FOUND");
  });
});

describe("scenarios and planning runs", () => {
  test("a created scenario can immediately drive a planning run", async () => {
    const { body } = await createScenario({ name: uniqueName("driver"), demandMultiplier: 1.6 });
    const { data: scenario } = expectEnvelope<ScenarioSummary>(body);

    const response = await server.post("/api/planning/runs", {
      horizonDays: 7,
      scenarioId: scenario.id,
    });
    assert.equal(response.status, 202, "POST /planning/runs already accepts scenarioId");

    const run = expectEnvelope<{ scenario: { id: string; name: string } | null }>(await response.json());
    assert.equal(run.data.scenario?.id, scenario.id, "the run must echo the scenario it will use");

    const after = expectEnvelope<ScenarioSummary>(await server.json("/api/scenarios/" + scenario.id));
    assert.equal(after.data.planningRunCount, 1, "the scenario must now count that run");
  });
});
