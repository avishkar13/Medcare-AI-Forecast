import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
  MOVEMENT_TYPES,
  applyDelta,
  deltaFor,
  directionOf,
  isDemand,
  isValidQuantity,
  wasClamped,
  type MovementType,
} from "../../src/utils/movement.js";

describe("movement direction rules", () => {
  test("every type declares a direction", () => {
    for (const type of MOVEMENT_TYPES) {
      assert.ok(["in", "out", "either"].includes(directionOf(type)), `${type} has no direction`);
    }
  });

  test("a directional type takes a positive magnitude and rejects a signed one", () => {
    // `{ RECEIPT, -180 }` could mean "receive 180" or "reverse a receipt"; rejecting it
    // is the only reading that cannot silently move stock the wrong way.
    for (const type of MOVEMENT_TYPES.filter((t) => directionOf(t) !== "either")) {
      assert.equal(isValidQuantity(type, 5), true, `${type} should accept 5`);
      assert.equal(isValidQuantity(type, -5), false, `${type} should reject -5 as ambiguous`);
    }
  });

  test("an adjustment may go either way", () => {
    assert.equal(isValidQuantity("ADJUSTMENT", 5), true);
    assert.equal(isValidQuantity("ADJUSTMENT", -5), true);
  });

  test("zero is never a valid movement", () => {
    for (const type of MOVEMENT_TYPES) {
      assert.equal(isValidQuantity(type, 0), false, `${type} accepted a zero movement`);
    }
  });

  test("a non-finite quantity is rejected", () => {
    assert.equal(isValidQuantity("SALE", Number.NaN), false);
    assert.equal(isValidQuantity("RECEIPT", Number.POSITIVE_INFINITY), false);
  });

  test("only a sale counts as realised demand", () => {
    assert.equal(isDemand("SALE"), true);
    for (const type of MOVEMENT_TYPES.filter((t) => t !== "SALE")) {
      assert.equal(isDemand(type), false, `${type} must not append to DemandHistory`);
    }
  });
});

describe("deltaFor", () => {
  test("outward types produce a negative delta, inward types a positive one", () => {
    assert.equal(deltaFor("SALE", 180), -180);
    assert.equal(deltaFor("WASTAGE", 20), -20);
    assert.equal(deltaFor("RECEIPT", 500), 500);
    assert.equal(deltaFor("TRANSFER_IN", 600), 600);
  });

  test("an adjustment is taken literally in both directions", () => {
    assert.equal(deltaFor("ADJUSTMENT", 12), 12);
    assert.equal(deltaFor("ADJUSTMENT", -12), -12);
  });
});

describe("applyDelta", () => {
  test("stockAfter is stockBefore plus the applied delta, always", () => {
    const cases: [number, number][] = [
      [500, -180],
      [500, 180],
      [0, 40],
      [320, -320],
      [10, -999],
    ];
    for (const [onHand, delta] of cases) {
      const change = applyDelta(onHand, delta);
      assert.equal(
        change.stockAfter,
        change.stockBefore + change.delta,
        `invariant broken for ${onHand} ${delta}`,
      );
    }
  });

  test("stock never goes negative", () => {
    const change = applyDelta(10, -999);
    assert.equal(change.stockAfter, 0);
  });

  test("a clamped movement reports the delta that actually happened", () => {
    // The request was -999 but only -10 was available. Recording -999 would leave a
    // ledger row that disagrees with the stock it describes.
    const change = applyDelta(10, -999);
    assert.equal(change.delta, -10);
    assert.equal(wasClamped(10, -999), true);
  });

  test("an unclamped movement reports the requested delta unchanged", () => {
    const change = applyDelta(500, -180);
    assert.equal(change.delta, -180);
    assert.equal(change.stockAfter, 320);
    assert.equal(wasClamped(500, -180), false);
  });

  test("the demo case: MED001 SALE -180 at Delhi takes 500 to 320", () => {
    const type: MovementType = "SALE";
    const change = applyDelta(500, deltaFor(type, 180));
    assert.equal(change.stockBefore, 500);
    assert.equal(change.stockAfter, 320);
  });
});
