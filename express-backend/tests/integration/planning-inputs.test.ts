import { strict as assert } from "node:assert";
import { after, describe, test } from "node:test";
import { teardown } from "../helpers/app.js";
import { loadPlanningInputs, pairKey, settingsOf, NEUTRAL_SCENARIO } from "../../src/lib/planning-inputs.js";
import { prisma } from "../../src/config/prisma.js";

after(async () => {
  await teardown();
});

describe("loadPlanningInputs", () => {
  test("returns one pair per position, and nothing else", async () => {
    const inputs = await loadPlanningInputs(null);

    assert.ok(inputs.positions.length > 0, "seed data is missing - run pnpm prisma:seed");
    assert.equal(inputs.pairs.length, inputs.positions.length);

    const positions = new Set(inputs.positions.map((p) => pairKey(p.productId, p.warehouseId)));
    for (const pair of inputs.pairs) {
      assert.ok(positions.has(pairKey(pair.productId, pair.warehouseId)));
    }
    assert.equal(new Set(inputs.pairs.map((p) => pairKey(p.productId, p.warehouseId))).size, inputs.pairs.length);
  });

  test("pairs are the positions held, not every pair with demand history", async () => {
    const inputs = await loadPlanningInputs(null);
    const withHistory = await prisma.demandHistory.groupBy({ by: ["productId", "warehouseId"] });

    assert.ok(
      inputs.pairs.length <= withHistory.length,
      "planning a pair that holds no inventory would produce a plan for nothing",
    );
  });

  test("planning parameters are keyed so a position can find its own", async () => {
    const inputs = await loadPlanningInputs(null);
    let matched = 0;

    for (const position of inputs.positions) {
      const parameters = inputs.parameters.get(pairKey(position.productId, position.warehouseId));
      if (!parameters) continue;
      matched += 1;
      assert.ok(parameters.leadTimeDays > 0);
      assert.ok(parameters.serviceLevel > 0 && parameters.serviceLevel < 1);
      assert.ok(parameters.reviewPeriodDays > 0);
    }

    assert.ok(matched > 0, "no position resolved its planning parameters");
  });

  test("batches are grouped by position and ordered soonest-expiring first", async () => {
    const inputs = await loadPlanningInputs(null);

    for (const [key, bucket] of inputs.batches) {
      assert.ok(bucket.length > 0, `${key} has an empty bucket`);
      for (const batch of bucket) {
        assert.equal(pairKey(batch.productId, batch.warehouseId), key);
        assert.ok(batch.quantity > 0);
      }
      for (let index = 1; index < bucket.length; index += 1) {
        assert.ok(
          bucket[index - 1]!.daysToExpiry <= bucket[index]!.daysToExpiry,
          `${key} is not in FEFO order`,
        );
      }
    }
  });

  test("no scenario resolves to the neutral one, which changes nothing", async () => {
    const inputs = await loadPlanningInputs(null);

    assert.equal(inputs.scenario, null);
    assert.deepEqual(settingsOf(inputs), NEUTRAL_SCENARIO);
    assert.equal(NEUTRAL_SCENARIO.demandMultiplier, 1);
    assert.equal(NEUTRAL_SCENARIO.leadTimeMultiplier, 1);
  });

  test("a scenario is resolved and carries its multipliers", async () => {
    const seeded = await prisma.scenario.findFirst();
    if (!seeded) return;

    const inputs = await loadPlanningInputs(seeded.id);
    assert.ok(inputs.scenario);
    assert.equal(inputs.scenario.id, seeded.id);
    assert.equal(settingsOf(inputs).demandMultiplier, seeded.demandMultiplier);
    assert.ok(settingsOf(inputs).demandMultiplier > 1, "the seeded scenario is a demand surge");
  });

  test("an unknown scenario id resolves to null rather than throwing", async () => {
    const inputs = await loadPlanningInputs("does-not-exist");
    assert.equal(inputs.scenario, null);
  });
});
