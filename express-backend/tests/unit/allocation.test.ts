import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { planTransfers, type AllocatablePosition } from "../../src/utils/allocation.js";

interface Position extends AllocatablePosition {
  code: string;
  waste: number;
}

const position = (
  code: string,
  onHand: number,
  reorderPoint: number,
  maximumInventory: number | null,
  waste = 0,
): Position => ({ code, onHand, reorderPoint, maximumInventory, waste });

const plan = (positions: Position[], minimumUnits = 1) =>
  planTransfers({ positions, wasteUnitsOf: (row) => row.waste, minimumUnits });

describe("planTransfers", () => {
  test("moves stock from a position above its maximum to one below its reorder point", () => {
    const short = position("DC-02", 20, 100, 500);
    const excess = position("DC-01", 900, 100, 500);

    const [transfer, ...rest] = plan([short, excess]);

    assert.equal(rest.length, 0, "one shortage and one surplus is one transfer");
    assert.ok(transfer);
    assert.equal(transfer.destination.code, "DC-02");
    assert.equal(transfer.source.code, "DC-01");
    assert.equal(transfer.need, 80);
    assert.equal(transfer.available, 400);
    assert.equal(transfer.quantity, 80, "a surplus large enough covers the whole need");
  });

  test("never drafts more than a source actually has above its maximum", () => {
    const short = position("DC-02", 0, 1_000, 500);
    const excess = position("DC-01", 530, 100, 500);

    const [transfer] = plan([short, excess]);

    assert.ok(transfer);
    assert.equal(transfer.quantity, 30, "only the 30 units above maximum are available");
  });

  test("conserves units - nothing is created and no source is overdrawn", () => {
    const positions = [
      position("DC-01", 900, 100, 500, 120),
      position("DC-02", 10, 200, 400),
      position("DC-03", 5, 150, 400),
      position("DC-04", 700, 100, 300, 40),
    ];

    const transfers = plan(positions);
    const drawnFrom = new Map<string, number>();

    for (const transfer of transfers) {
      drawnFrom.set(
        transfer.source.code,
        (drawnFrom.get(transfer.source.code) ?? 0) + transfer.quantity,
      );
    }

    for (const [code, drawn] of drawnFrom) {
      const source = positions.find((row) => row.code === code)!;
      const availableUnits = source.onHand - (source.maximumInventory ?? 0);
      assert.ok(
        drawn <= availableUnits,
        code + " was overdrawn: " + drawn + " taken from " + availableUnits,
      );
    }
  });

  test("never proposes moving stock to the warehouse it came from", () => {
    // maximumInventory below reorderPoint makes one position both short and in excess.
    // The high waste figure sorts it to the front of the source list, so without a
    // guard it is selected to resupply itself.
    const contradictory = position("DC-01", 60, 100, 50, 999);

    assert.deepEqual(plan([contradictory]), [], "a position cannot resupply itself");

    for (const transfer of plan([contradictory, position("DC-02", 900, 100, 500)])) {
      assert.notEqual(transfer.source.code, transfer.destination.code);
    }
  });

  test("a position below its reorder point is not treated as a donor", () => {
    const needyButOverMax = position("DC-01", 60, 100, 50, 999);
    const short = position("DC-02", 0, 200, 500);

    for (const transfer of plan([needyButOverMax, short])) {
      assert.notEqual(
        transfer.source.code,
        "DC-01",
        "a warehouse that is itself short must not be drained further",
      );
    }
  });

  test("credits rescued units only up to what would actually have expired", () => {
    const short = position("DC-02", 0, 100, 500);
    const excess = position("DC-01", 800, 100, 500, 30);

    const [transfer] = plan([short, excess]);

    assert.ok(transfer);
    assert.equal(transfer.quantity, 100);
    assert.equal(transfer.unitsRescued, 30, "only 30 units were going to be wasted");
    assert.ok(transfer.unitsRescued <= transfer.quantity);
  });

  test("drains the source closest to expiry first", () => {
    const short = position("DC-03", 0, 100, 500);
    const fresh = position("DC-01", 800, 100, 500, 0);
    const expiring = position("DC-02", 800, 100, 500, 250);

    const [transfer] = plan([short, fresh, expiring]);

    assert.ok(transfer);
    assert.equal(transfer.source.code, "DC-02", "the expiring surplus should be used first");
  });

  test("serves the largest shortage first", () => {
    const small = position("DC-02", 90, 100, 500);
    const large = position("DC-03", 0, 300, 500);
    const excess = position("DC-01", 900, 100, 500);

    const [first] = plan([small, large, excess]);

    assert.ok(first);
    assert.equal(first.destination.code, "DC-03");
  });

  test("skips transfers below the actionable minimum", () => {
    const short = position("DC-02", 99, 100, 500);
    const excess = position("DC-01", 900, 100, 500);

    assert.equal(plan([short, excess], 25).length, 0, "a 1-unit move is not worth a truck");
    assert.equal(plan([short, excess], 1).length, 1);
  });

  test("returns nothing when there is no shortage or no surplus", () => {
    assert.deepEqual(plan([position("DC-01", 900, 100, 500)]), [], "surplus but nobody needs it");
    assert.deepEqual(plan([position("DC-02", 10, 100, 500)]), [], "shortage but no surplus");
    assert.deepEqual(plan([]), []);
  });

  test("treats a position with no maximum as never in excess", () => {
    const short = position("DC-02", 10, 100, 500);
    const uncapped = position("DC-01", 100_000, 100, null);

    assert.deepEqual(plan([short, uncapped]), [], "an uncapped warehouse holds no declared surplus");
  });

  test("does not mutate the positions it is given", () => {
    const positions = [
      position("DC-01", 900, 100, 500, 120),
      position("DC-02", 10, 200, 400),
    ];
    const before = structuredClone(positions);

    plan(positions);

    assert.deepEqual(positions, before);
  });
});
