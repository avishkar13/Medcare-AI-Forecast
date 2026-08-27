import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
  aggregateOverdueSupply,
  type SupplyOrderRow,
} from "../../src/utils/supply.js";

const NOW = Date.parse("2026-08-27T00:00:00.000Z");
const MS_PER_DAY = 86_400_000;

const daysAgo = (days: number) => new Date(NOW - days * MS_PER_DAY);

const order = (overrides: Partial<SupplyOrderRow> = {}): SupplyOrderRow => ({
  productId: "p1",
  warehouseId: "w1",
  quantity: 100,
  fulfilledQuantity: 0,
  requestedDate: daysAgo(5),
  ...overrides,
});

describe("aggregateOverdueSupply", () => {
  test("returns nothing for no orders", () => {
    assert.deepEqual(aggregateOverdueSupply([], NOW), []);
  });

  test("outstanding is what was ordered minus what arrived", () => {
    const [row] = aggregateOverdueSupply([order({ quantity: 100, fulfilledQuantity: 30 })], NOW);
    assert.equal(row!.outstanding, 70);
  });

  test("a null fulfilledQuantity means nothing arrived", () => {
    const [row] = aggregateOverdueSupply([order({ quantity: 100, fulfilledQuantity: null })], NOW);
    assert.equal(row!.outstanding, 100);
  });

  /**
   * A pair whose every order landed must be absent, not present with zero. The
   * detector reads the length of this list, so a zero row would raise an alert about
   * supply that is not actually late.
   */
  test("drops orders that arrived in full rather than counting them as zero", () => {
    const rows = aggregateOverdueSupply(
      [order({ quantity: 100, fulfilledQuantity: 100 })],
      NOW,
    );
    assert.deepEqual(rows, []);
  });

  test("drops over-delivered orders", () => {
    const rows = aggregateOverdueSupply(
      [order({ quantity: 100, fulfilledQuantity: 140 })],
      NOW,
    );
    assert.deepEqual(rows, []);
  });

  test("sums outstanding across a pair and counts the orders", () => {
    const rows = aggregateOverdueSupply(
      [
        order({ quantity: 100, fulfilledQuantity: 40 }),
        order({ quantity: 50, fulfilledQuantity: 0 }),
        order({ quantity: 30, fulfilledQuantity: 30 }), // fully arrived, ignored
      ],
      NOW,
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.outstanding, 110);
    assert.equal(rows[0]!.orderCount, 2);
  });

  /** The worst lateness is what a planner acts on, not the average of the group. */
  test("daysLate is the worst in the group", () => {
    const rows = aggregateOverdueSupply(
      [
        order({ requestedDate: daysAgo(4) }),
        order({ requestedDate: daysAgo(19) }),
        order({ requestedDate: daysAgo(7) }),
      ],
      NOW,
    );

    assert.equal(rows[0]!.daysLate, 19);
  });

  test("keeps product and warehouse apart", () => {
    const rows = aggregateOverdueSupply(
      [
        order({ productId: "p1", warehouseId: "w1", quantity: 10, fulfilledQuantity: 0 }),
        order({ productId: "p1", warehouseId: "w2", quantity: 20, fulfilledQuantity: 0 }),
        order({ productId: "p2", warehouseId: "w1", quantity: 30, fulfilledQuantity: 0 }),
      ],
      NOW,
    );

    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => [row.productId, row.warehouseId, row.outstanding]).sort(),
      [
        ["p1", "w1", 10],
        ["p1", "w2", 20],
        ["p2", "w1", 30],
      ].sort(),
    );
  });

  test("lateness is measured against the supplied clock, not the real one", () => {
    const rows = aggregateOverdueSupply([order({ requestedDate: daysAgo(3) })], NOW);
    assert.equal(rows[0]!.daysLate, 3);

    const later = aggregateOverdueSupply(
      [order({ requestedDate: daysAgo(3) })],
      NOW + 10 * MS_PER_DAY,
    );
    assert.equal(later[0]!.daysLate, 13);
  });

  /** Partial days round down: an order 36 hours late is one day late, not two. */
  test("rounds partial days down", () => {
    const rows = aggregateOverdueSupply(
      [order({ requestedDate: new Date(NOW - 1.5 * MS_PER_DAY) })],
      NOW,
    );
    assert.equal(rows[0]!.daysLate, 1);
  });
});
