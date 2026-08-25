import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectErrorShape } from "../helpers/assertions.js";
import { prisma } from "../../src/config/prisma.js";

// PLANNING_EXECUTOR is "disabled" via tests/helpers/app.ts, so a what-if creates the
// run and leaves it PENDING - which is exactly what this suite wants to assert.

let server: TestServer;
const scenarios: string[] = [];
const runs: string[] = [];

const name = (label: string) => `simtest-${label}-${randomUUID().slice(0, 8)}`;

interface Scenario {
  id: string;
  name: string;
  params: {
    demandShockPercent: number;
    leadTimeChangePercent: number;
    capacityChangePercent: number;
    serviceLevelTargetPercent: number;
  };
  multipliers: { demandMultiplier: number; serviceLevelTarget: number };
  planningRunCount: number;
}

const track = (scenario: Scenario) => {
  scenarios.push(scenario.id);
  return scenario;
};

/**
 * Closes the run a what-if started.
 *
 * `createRun` allows one active run at a time, so a second what-if would be refused
 * with a 409 while the first sits PENDING. That guard is correct - two concurrent
 * runs would fight over the same artefact tables - so the suite closes each run
 * rather than working around it.
 */
const settle = async (runId: string) => {
  runs.push(runId);
  await prisma.planningRun.update({
    where: { id: runId },
    data: { status: "COMPLETED", startedAt: new Date(), completedAt: new Date() },
  });
};

before(async () => {
  server = await startServer(app);
});

after(async () => {
  for (const id of runs) await prisma.planningRun.deleteMany({ where: { id } });
  await prisma.scenario.deleteMany({ where: { id: { in: scenarios } } });
  await server.close();
  await teardown();
});

describe("POST /api/simulation/run", () => {
  test("creates a real scenario and run instead of computing a formula", async () => {
    const response = await server.post("/api/simulation/run", {
      name: name("surge"),
      horizonDays: 7,
      params: { demandShockPercent: 60, serviceLevelTargetPercent: 98 },
    });

    assert.equal(response.status, 202, "the run is accepted, not finished");

    const { data } = expectEnvelope<{
      scenario: Scenario;
      run: { id: string; status: string };
      pollAt: string;
    }>(await response.json());

    track(data.scenario);
    await settle(data.run.id);

    // The multipliers a Scenario stores, derived from the percentages the UI sends.
    assert.equal(data.scenario.multipliers.demandMultiplier, 1.6);
    assert.equal(data.scenario.multipliers.serviceLevelTarget, 0.98);

    const stored = await prisma.scenario.findUnique({ where: { id: data.scenario.id } });
    assert.ok(stored, "the scenario must be persisted, not just echoed back");

    const run = await prisma.planningRun.findUnique({ where: { id: data.run.id } });
    assert.equal(run?.scenarioId, data.scenario.id, "the run must be attached to the scenario");
    assert.ok(data.pollAt.includes(data.run.id), "the caller is told where to poll");
  });

  test("percentages round-trip back to the form that produced them", async () => {
    const response = await server.post("/api/simulation/run", {
      name: name("roundtrip"),
      horizonDays: 3,
      params: {
        demandShockPercent: 25,
        leadTimeChangePercent: -10,
        capacityChangePercent: 50,
        serviceLevelTargetPercent: 90,
      },
    });

    const { data } = expectEnvelope<{ scenario: Scenario; run: { id: string } }>(
      await response.json(),
    );
    track(data.scenario);
    await settle(data.run.id);

    assert.equal(data.scenario.params.demandShockPercent, 25);
    assert.equal(data.scenario.params.leadTimeChangePercent, -10);
    assert.equal(data.scenario.params.capacityChangePercent, 50);
    assert.equal(data.scenario.params.serviceLevelTargetPercent, 90);
  });

  test("rejects a shock outside the documented band", async () => {
    const response = await server.post("/api/simulation/run", {
      name: name("bad"),
      params: { demandShockPercent: 5000 },
    });
    assert.equal(response.status, 422);
    expectErrorShape(await response.json(), "VALIDATION_FAILED");
  });

  test("rejects an unknown field rather than dropping it", async () => {
    const response = await server.post("/api/simulation/run", {
      name: name("typo"),
      params: { demandShockPct: 60 },
    });
    assert.equal(response.status, 422, "a misspelled parameter must not run a neutral scenario");
  });
});

describe("saved scenarios", () => {
  test("saving stores the parameters and does not start a run", async () => {
    const response = await server.post("/api/simulation/save", {
      name: name("preset"),
      params: { demandShockPercent: 30 },
    });
    assert.equal(response.status, 201);

    const { data } = expectEnvelope<Scenario>(await response.json());
    track(data);

    assert.equal(data.planningRunCount, 0, "a saved preset has not been run");
    assert.equal(data.multipliers.demandMultiplier, 1.3);
  });

  test("saved lists presets, history lists what has actually run", async () => {
    const saved = expectEnvelope<Scenario[]>(await server.json("/api/simulation/saved?limit=100"));
    const history = expectEnvelope<(Scenario & { latestRun: unknown })[]>(
      await server.json("/api/simulation/history?limit=100"),
    );

    for (const scenario of saved.data) {
      assert.equal(scenario.planningRunCount, 0, "a saved preset with runs belongs in history");
    }
    for (const scenario of history.data) {
      assert.ok(scenario.planningRunCount > 0, "history is scenarios that ran");
      assert.ok(scenario.latestRun, "each history row carries the run to look at");
    }
  });

  test("deleting a preset works; deleting one with runs is refused", async () => {
    const saveResponse = await server.post("/api/simulation/save", {
      name: name("throwaway"),
      params: {},
    });
    const { data: preset } = expectEnvelope<Scenario>(await saveResponse.json());

    const deleted = await fetch(`${server.url}/api/simulation/saved/${preset.id}`, {
      method: "DELETE",
    });
    assert.equal(deleted.status, 204);
    assert.equal(await prisma.scenario.count({ where: { id: preset.id } }), 0);

    // A scenario a run points at cannot go: the run would lose the record of what
    // it was modelling.
    const runResponse = await server.post("/api/simulation/run", {
      name: name("undeletable"),
      horizonDays: 3,
      params: { demandShockPercent: 10 },
    });
    const { data } = expectEnvelope<{ scenario: Scenario; run: { id: string } }>(
      await runResponse.json(),
    );
    track(data.scenario);
    await settle(data.run.id);

    const refused = await fetch(`${server.url}/api/simulation/saved/${data.scenario.id}`, {
      method: "DELETE",
    });
    assert.equal(refused.status, 409);
    expectErrorShape(await refused.json(), "CONFLICT");
  });

  test("404s when deleting something that is not there", async () => {
    const response = await fetch(`${server.url}/api/simulation/saved/nope`, { method: "DELETE" });
    assert.equal(response.status, 404);
  });
});
