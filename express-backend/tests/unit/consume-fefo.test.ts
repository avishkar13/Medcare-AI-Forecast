import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { consumeFefo } from "../../src/utils/inventory.js";

const batch = (id: string, quantity: number) => ({ id, quantity });

describe("consumeFefo", () => {
  test("takes everything from the first batch when it covers the draw", () => {
    const { draws, shortfall } = consumeFefo([batch("a", 100), batch("b", 50)], 40);

    assert.equal(shortfall, 0);
    assert.deepEqual(draws, [{ id: "a", units: 40, remaining: 60 }]);
  });

  test("spills into later batches in the order given", () => {
    const { draws, shortfall } = consumeFefo([batch("a", 30), batch("b", 50)], 65);

    assert.equal(shortfall, 0);
    assert.deepEqual(draws, [
      { id: "a", units: 30, remaining: 0 },
      { id: "b", units: 35, remaining: 15 },
    ]);
  });

  test("a batch drained exactly reports zero remaining rather than being skipped", () => {
    const { draws } = consumeFefo([batch("a", 25)], 25);

    assert.deepEqual(draws, [{ id: "a", units: 25, remaining: 0 }]);
  });

  // The sub-ledger can hold less than Inventory.onHand on a position that was seeded
  // without batches. That is reported, not thrown on.
  test("reports what the batches could not cover", () => {
    const { draws, shortfall } = consumeFefo([batch("a", 10)], 30);

    assert.equal(shortfall, 20);
    assert.deepEqual(draws, [{ id: "a", units: 10, remaining: 0 }]);
  });

  test("no batches at all is a full shortfall, not a crash", () => {
    const { draws, shortfall } = consumeFefo([], 15);

    assert.equal(shortfall, 15);
    assert.deepEqual(draws, []);
  });

  test("draws nothing for a zero or negative request", () => {
    assert.deepEqual(consumeFefo([batch("a", 10)], 0), { draws: [], shortfall: 0 });
    assert.deepEqual(consumeFefo([batch("a", 10)], -5), { draws: [], shortfall: 0 });
  });

  test("stops as soon as the draw is satisfied, leaving later batches untouched", () => {
    const { draws } = consumeFefo([batch("a", 100), batch("b", 100), batch("c", 100)], 50);

    assert.equal(draws.length, 1);
    assert.equal(draws[0]!.id, "a");
  });

  test("skips an empty batch rather than emitting a zero-unit draw", () => {
    const { draws, shortfall } = consumeFefo([batch("a", 0), batch("b", 20)], 20);

    assert.equal(shortfall, 0);
    assert.deepEqual(draws, [{ id: "b", units: 20, remaining: 0 }]);
  });

  test("fractional quantities do not accumulate float error", () => {
    const { draws, shortfall } = consumeFefo([batch("a", 0.1), batch("b", 0.2)], 0.3);

    assert.equal(shortfall, 0);
    assert.deepEqual(draws, [
      { id: "a", units: 0.1, remaining: 0 },
      { id: "b", units: 0.2, remaining: 0 },
    ]);
  });
});
