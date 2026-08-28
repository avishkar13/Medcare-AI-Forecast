import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
  allocateTransfers,
  availableStock,
  classifyRisk,
  classifyStock,
  expectedShortfall,
  expirySeverity,
  inventoryPosition,
  normalCdf,
  normalPdf,
  orderUpToLevel,
  percentage,
  projectFefoWaste,
  reorderPoint,
  round,
  safetyStock,
  stdDevFromBand,
  supplyUrgency,
  type DemandProfile,
  zScore,
} from "../../src/utils/inventory.js";
import { closeTo } from "../helpers/assertions.js";

const profile = (overrides: Partial<DemandProfile> = {}): DemandProfile => ({
  avgDailyDemand: 100,
  demandStdDev: 20,
  leadTimeDays: 9,
  leadTimeStdDev: 0,
  serviceLevel: 0.95,
  ...overrides,
});

describe("zScore", () => {
  test("matches published normal quantiles", () => {
    closeTo(zScore(0.5), 0, 1e-4);
    closeTo(zScore(0.9), 1.2815515655, 1e-4);
    closeTo(zScore(0.95), 1.644853627, 1e-4);
    closeTo(zScore(0.975), 1.959963985, 1e-4);
    closeTo(zScore(0.99), 2.326347874, 1e-4);
  });

  test("lower tail branch below p=0.02425", () => {
    closeTo(zScore(0.01), -2.326347874, 1e-4);
    closeTo(zScore(0.001), -3.090232306, 1e-3);
  });

  test("upper tail branch above p=0.97575", () => {
    closeTo(zScore(0.99), 2.326347874, 1e-4);
    closeTo(zScore(0.999), 3.090232306, 1e-3);
  });

  test("is symmetric about 0.5", () => {
    for (const p of [0.6, 0.75, 0.9, 0.95, 0.99]) {
      closeTo(zScore(p), -zScore(1 - p), 1e-6);
    }
  });

  test("clamps degenerate probabilities to finite values", () => {
    assert.ok(Number.isFinite(zScore(0)), "z(0) must be finite");
    assert.ok(Number.isFinite(zScore(1)), "z(1) must be finite");
    assert.ok(Number.isFinite(zScore(-5)));
    assert.ok(Number.isFinite(zScore(5)));
  });

  test("is monotonically increasing", () => {
    let previous = zScore(0.01);
    for (let p = 0.02; p < 1; p += 0.01) {
      const current = zScore(p);
      assert.ok(current > previous, `not monotonic at p=${p.toFixed(2)}`);
      previous = current;
    }
  });
});

describe("safetyStock", () => {
  test("is zero when demand and lead time have no variance", () => {
    assert.equal(safetyStock(profile({ demandStdDev: 0, leadTimeStdDev: 0 })), 0);
  });

  test("equals z * sigma * sqrt(leadTime) when only demand varies", () => {
    const input = profile({ demandStdDev: 20, leadTimeDays: 9, leadTimeStdDev: 0 });
    closeTo(safetyStock(input), zScore(0.95) * 20 * 3, 1e-9);
  });

  test("lead-time variance raises the buffer", () => {
    const withoutLeadTimeVariance = safetyStock(profile({ leadTimeStdDev: 0 }));
    const withLeadTimeVariance = safetyStock(profile({ leadTimeStdDev: 3 }));
    assert.ok(
      withLeadTimeVariance > withoutLeadTimeVariance,
      "ignoring lead-time variance under-sizes safety stock",
    );
  });

  test("uses the full sqrt(LT*sd^2 + mu^2*slt^2) formula", () => {
    const input = profile({ avgDailyDemand: 100, demandStdDev: 20, leadTimeDays: 9, leadTimeStdDev: 3 });
    const expected = zScore(0.95) * Math.sqrt(9 * 400 + 10_000 * 9);
    closeTo(safetyStock(input), expected, 1e-9);
  });

  test("a higher service level demands more stock", () => {
    const low = safetyStock(profile({ serviceLevel: 0.9 }));
    const high = safetyStock(profile({ serviceLevel: 0.99 }));
    assert.ok(high > low);
  });

  test("never returns a negative buffer", () => {
    assert.ok(safetyStock(profile({ serviceLevel: 0.1 })) >= 0);
    assert.ok(safetyStock(profile({ serviceLevel: 0.5 })) >= 0);
  });
});

describe("reorderPoint", () => {
  test("is lead-time demand plus safety stock", () => {
    const input = profile();
    closeTo(reorderPoint(input), 100 * 9 + safetyStock(input), 1e-9);
  });

  test("collapses to lead-time demand with no variance", () => {
    closeTo(reorderPoint(profile({ demandStdDev: 0, leadTimeStdDev: 0 })), 900, 1e-9);
  });
});

describe("projectFefoWaste", () => {
  test("wastes nothing when demand clears the batch first", () => {
    assert.deepEqual(projectFefoWaste([{ quantity: 100, daysToExpiry: 30 }], 10), [0]);
  });

  test("wastes the remainder demand cannot reach", () => {
    assert.deepEqual(projectFefoWaste([{ quantity: 100, daysToExpiry: 5 }], 10), [50]);
  });

  test("does not let two batches spend the same demand twice", () => {
    const batches = [
      { quantity: 500, daysToExpiry: 7 },
      { quantity: 500, daysToExpiry: 14 },
      { quantity: 500, daysToExpiry: 21 },
    ];
    const naive = batches.map((batch) => Math.max(0, batch.quantity - 50 * batch.daysToExpiry));
    const fefo = projectFefoWaste(batches, 50);

    assert.deepEqual(naive, [150, 0, 0], "naive per-batch maths judges the later batches safe");
    assert.deepEqual(fefo, [150, 300, 450], "FEFO charges each batch for the stock queued ahead of it");
    assert.ok(
      fefo.reduce((a, b) => a + b, 0) > naive.reduce((a, b) => a + b, 0),
      "FEFO must report at least as much waste as the naive calculation",
    );
  });

  test("wastes everything when there is no demand", () => {
    assert.deepEqual(projectFefoWaste([{ quantity: 40, daysToExpiry: 90 }], 0), [40]);
  });

  test("treats already-expired batches as having no time left", () => {
    assert.deepEqual(projectFefoWaste([{ quantity: 40, daysToExpiry: -10 }], 5), [40]);
  });

  test("never reports more waste than the batch holds", () => {
    const batches = [
      { quantity: 10, daysToExpiry: 1 },
      { quantity: 10, daysToExpiry: 2 },
      { quantity: 10, daysToExpiry: 3 },
    ];
    for (const [index, waste] of projectFefoWaste(batches, 0).entries()) {
      assert.ok(waste <= batches[index]!.quantity, `batch ${index} wasted more than it held`);
    }
  });

  test("returns one result per batch, in input order", () => {
    const batches = [
      { quantity: 5, daysToExpiry: 1 },
      { quantity: 5, daysToExpiry: 100 },
    ];
    const waste = projectFefoWaste(batches, 1);
    assert.equal(waste.length, 2);
    assert.ok(waste[0]! > waste[1]!, "the sooner-expiring batch should carry more risk");
  });

  test("handles an empty batch list", () => {
    assert.deepEqual(projectFefoWaste([], 10), []);
  });
});

describe("round", () => {
  test("defaults to two decimals", () => {
    assert.equal(round(1.23456), 1.23);
    assert.equal(round(1.235), 1.24);
  });

  test("honours an explicit precision", () => {
    assert.equal(round(1.23456, 3), 1.235);
    assert.equal(round(1.5, 0), 2);
  });

  test("handles negatives", () => {
    assert.equal(round(-1.235, 2), -1.24);
  });
});

describe("percentage", () => {
  test("computes a share of the whole", () => {
    assert.equal(percentage(25, 100), 25);
    assert.equal(percentage(1, 3), 33.33);
  });

  test("returns zero rather than dividing by zero", () => {
    assert.equal(percentage(5, 0), 0);
    assert.equal(percentage(5, -1), 0);
  });
});

describe("classifyStock", () => {
  const none = {
    belowSafetyStock: false,
    belowReorderPoint: false,
    expiringSoon: false,
    aboveMaximum: false,
  };

  test("reports healthy when nothing is wrong", () => {
    assert.equal(classifyStock(none), "healthy");
  });

  test("recognises each condition on its own", () => {
    assert.equal(classifyStock({ ...none, belowSafetyStock: true }), "criticalStock");
    assert.equal(classifyStock({ ...none, belowReorderPoint: true }), "belowReorderPoint");
    assert.equal(classifyStock({ ...none, expiringSoon: true }), "expiringSoon");
    assert.equal(classifyStock({ ...none, aboveMaximum: true }), "excessStock");
  });

  test("shortage outranks expiry, because a stockout is a patient-safety event", () => {
    assert.equal(
      classifyStock({ ...none, belowSafetyStock: true, expiringSoon: true }),
      "criticalStock",
    );
    assert.equal(
      classifyStock({ ...none, belowReorderPoint: true, expiringSoon: true }),
      "belowReorderPoint",
    );
  });

  test("running out outranks merely needing a reorder", () => {
    assert.equal(
      classifyStock({ ...none, belowSafetyStock: true, belowReorderPoint: true }),
      "criticalStock",
    );
  });

  test("expiry outranks plain excess, because expiring stock has a deadline", () => {
    assert.equal(
      classifyStock({ ...none, expiringSoon: true, aboveMaximum: true }),
      "expiringSoon",
      "overstock that is also expiring must surface as the expiry problem",
    );
  });

  test("resolves the full priority chain when every condition holds at once", () => {
    assert.equal(
      classifyStock({
        belowSafetyStock: true,
        belowReorderPoint: true,
        expiringSoon: true,
        aboveMaximum: true,
      }),
      "criticalStock",
    );
  });

  test("assigns exactly one state to every combination of conditions", () => {
    const states = new Set<string>();
    for (let mask = 0; mask < 16; mask += 1) {
      const state = classifyStock({
        belowSafetyStock: Boolean(mask & 1),
        belowReorderPoint: Boolean(mask & 2),
        expiringSoon: Boolean(mask & 4),
        aboveMaximum: Boolean(mask & 8),
      });
      assert.equal(typeof state, "string");
      states.add(state);
    }
    assert.equal(states.size, 5, "all five states must be reachable");
  });
});

describe("allocateTransfers", () => {
  test("matches a shortage against the first source with stock", () => {
    const matches = allocateTransfers([100], [{ available: 500, wasteRemaining: 0 }]);
    assert.deepEqual(matches, [{ sourceIndex: 0, quantity: 100, unitsRescued: 0 }]);
  });

  test("moves only what the source actually has", () => {
    const matches = allocateTransfers([500], [{ available: 200, wasteRemaining: 0 }]);
    assert.equal(matches[0]!.quantity, 200, "a transfer cannot exceed the surplus");
  });

  test("never draws the same units twice", () => {
    const sources = [{ available: 300, wasteRemaining: 0 }];
    const matches = allocateTransfers([200, 200], sources);

    const drawn = matches.reduce((total, match) => total + (match?.quantity ?? 0), 0);
    assert.ok(drawn <= 300, "drew " + drawn + " units from a surplus of 300");
    assert.equal(matches[0]!.quantity, 200);
    assert.equal(matches[1]!.quantity, 100, "the second transfer gets only what is left");
  });

  test("never credits the same avoided waste twice", () => {
    const sources = [{ available: 1000, wasteRemaining: 500 }];
    const matches = allocateTransfers([400, 400], sources);

    const rescued = matches.reduce((total, match) => total + (match?.unitsRescued ?? 0), 0);
    assert.ok(
      rescued <= 500,
      "credited " + rescued + " units of avoided waste from a pool of only 500",
    );
    assert.equal(matches[0]!.unitsRescued, 400);
    assert.equal(matches[1]!.unitsRescued, 100, "only the remaining waste can still be rescued");
  });

  test("credits no more waste than the quantity actually moved", () => {
    const matches = allocateTransfers([50], [{ available: 900, wasteRemaining: 900 }]);
    assert.equal(matches[0]!.unitsRescued, 50, "moving 50 units cannot rescue more than 50");
  });

  test("moves on to the next source once one is drained", () => {
    const matches = allocateTransfers(
      [100, 100],
      [
        { available: 100, wasteRemaining: 0 },
        { available: 100, wasteRemaining: 0 },
      ],
    );
    assert.equal(matches[0]!.sourceIndex, 0);
    assert.equal(matches[1]!.sourceIndex, 1);
  });

  test("returns null when no surplus is left", () => {
    const matches = allocateTransfers([100, 100], [{ available: 100, wasteRemaining: 0 }]);
    assert.ok(matches[0]);
    assert.equal(matches[1], null);
  });

  test("returns null rather than an instruction to move nothing", () => {
    assert.deepEqual(allocateTransfers([0.4], [{ available: 500, wasteRemaining: 0 }]), [null]);
    assert.deepEqual(allocateTransfers([100], [{ available: 0.4, wasteRemaining: 0 }]), [null]);
  });

  test("does not mutate the caller's sources", () => {
    const sources = [{ available: 500, wasteRemaining: 300 }];
    allocateTransfers([200], sources);
    assert.deepEqual(sources, [{ available: 500, wasteRemaining: 300 }]);
  });

  test("returns one entry per shortage, in order", () => {
    const matches = allocateTransfers([10, 20, 30], [{ available: 1000, wasteRemaining: 0 }]);
    assert.equal(matches.length, 3);
    assert.deepEqual(matches.map((match) => match?.quantity), [10, 20, 30]);
  });

  test("handles no shortages and no sources", () => {
    assert.deepEqual(allocateTransfers([], [{ available: 10, wasteRemaining: 0 }]), []);
    assert.deepEqual(allocateTransfers([100], []), [null]);
  });
});

describe("expirySeverity", () => {
  test("bands are inclusive at each boundary", () => {
    assert.equal(expirySeverity(15), "critical");
    assert.equal(expirySeverity(16), "high");
    assert.equal(expirySeverity(30), "high");
    assert.equal(expirySeverity(31), "medium");
    assert.equal(expirySeverity(60), "medium");
    assert.equal(expirySeverity(61), "low");
  });

  test("stock that already expired is critical, not low", () => {
    assert.equal(expirySeverity(0), "critical");
    assert.equal(expirySeverity(-40), "critical");
  });
});

describe("classifyRisk", () => {
  const none = {
    belowSafetyStock: false,
    belowReorderPoint: false,
    aboveMaximum: false,
    daysToNearestExpiry: null,
  };

  test("a position with nothing wrong is low risk", () => {
    assert.equal(classifyRisk(none), "low");
  });

  test("a spent safety buffer is critical", () => {
    assert.equal(classifyRisk({ ...none, belowSafetyStock: true, belowReorderPoint: true }), "critical");
  });

  test("below reorder point but above safety stock is high", () => {
    assert.equal(classifyRisk({ ...none, belowReorderPoint: true }), "high");
  });

  test("excess capital alone is medium", () => {
    assert.equal(classifyRisk({ ...none, aboveMaximum: true }), "medium");
  });

  test("expiry alone is scored on the same bands as a batch", () => {
    assert.equal(classifyRisk({ ...none, daysToNearestExpiry: 10 }), "critical");
    assert.equal(classifyRisk({ ...none, daysToNearestExpiry: 25 }), "high");
    assert.equal(classifyRisk({ ...none, daysToNearestExpiry: 45 }), "medium");
    assert.equal(classifyRisk({ ...none, daysToNearestExpiry: 200 }), "low");
  });

  test("the worst dimension wins, whichever it is", () => {
    assert.equal(classifyRisk({ ...none, aboveMaximum: true, daysToNearestExpiry: 5 }), "critical");
    assert.equal(classifyRisk({ ...none, belowReorderPoint: true, daysToNearestExpiry: 5 }), "critical");
    assert.equal(classifyRisk({ ...none, belowSafetyStock: true, daysToNearestExpiry: 300 }), "critical");
    assert.equal(classifyRisk({ ...none, aboveMaximum: true, daysToNearestExpiry: 300 }), "medium");
  });

  test("a healthy position holding stock that expires next year stays low", () => {
    assert.equal(classifyRisk({ ...none, daysToNearestExpiry: 365 }), "low");
  });
});

describe("supplyUrgency", () => {
  test("a position that consumes stock is ranked by its days of supply", () => {
    assert.equal(supplyUrgency({ avgDailyDemand: 12, daysOfSupply: 4 }), 4);
  });

  test("no recorded demand ranks last, not first", () => {
    const idle = supplyUrgency({ avgDailyDemand: 0, daysOfSupply: 0 });
    const urgent = supplyUrgency({ avgDailyDemand: 50, daysOfSupply: 0.5 });

    assert.equal(idle, Number.POSITIVE_INFINITY);
    assert.ok(idle > urgent, "a position with unknown supply is not more urgent than one running out");
  });

  test("zero days of supply with real demand is the most urgent case there is", () => {
    assert.equal(supplyUrgency({ avgDailyDemand: 30, daysOfSupply: 0 }), 0);
  });
});

describe("normalCdf", () => {
  test("round-trips against zScore, which is its inverse", () => {
    for (const probability of [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99]) {
      const recovered = normalCdf(zScore(probability));
      assert.ok(
        Math.abs(recovered - probability) < 1e-6,
        "zScore(" + probability + ") did not round-trip: got " + recovered,
      );
    }
  });

  test("is monotone increasing", () => {
    let previous = normalCdf(-5);
    for (let z = -4.9; z <= 5; z += 0.1) {
      const current = normalCdf(z);
      assert.ok(current >= previous, "decreased at z=" + z);
      previous = current;
    }
  });

  test("is symmetric about zero", () => {
    assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-9);
    for (const z of [0.5, 1, 1.96, 3]) {
      assert.ok(Math.abs(normalCdf(z) + normalCdf(-z) - 1) < 1e-7, "asymmetric at z=" + z);
    }
  });

  test("matches the textbook values a service level is read from", () => {
    assert.ok(Math.abs(normalCdf(1.6448536) - 0.95) < 1e-6);
    assert.ok(Math.abs(normalCdf(1.959964) - 0.975) < 1e-6);
  });

  test("saturates without escaping [0, 1]", () => {
    assert.ok(normalCdf(-40) >= 0);
    assert.ok(normalCdf(40) <= 1);
  });
});

describe("normalPdf", () => {
  test("peaks at zero with the standard normal height", () => {
    assert.ok(Math.abs(normalPdf(0) - 1 / Math.sqrt(2 * Math.PI)) < 1e-12);
  });

  test("is symmetric and always positive", () => {
    for (const z of [0.5, 1, 2.5]) {
      assert.ok(Math.abs(normalPdf(z) - normalPdf(-z)) < 1e-12);
      assert.ok(normalPdf(z) > 0);
    }
  });
});

describe("stdDevFromBand", () => {
  test("recovers the sigma that produced the band", () => {
    const sigma = 40;
    const median = 500;
    const p10 = median + zScore(0.1) * sigma;
    const p90 = median + zScore(0.9) * sigma;

    assert.ok(Math.abs(stdDevFromBand(p10, p90) - sigma) < 1e-3);
  });

  test("a band of zero width is zero uncertainty", () => {
    assert.equal(stdDevFromBand(120, 120), 0);
  });

  test("never returns a negative sigma, even from an inverted band", () => {
    assert.equal(stdDevFromBand(900, 100), 0);
  });

  test("widens as the band widens", () => {
    assert.ok(stdDevFromBand(400, 600) > stdDevFromBand(450, 550));
  });
});

describe("orderUpToLevel", () => {
  test("covers lead time plus one review period, plus the buffer", () => {
    const level = orderUpToLevel({
      avgDailyDemand: 10,
      leadTimeDays: 7,
      reviewPeriodDays: 7,
      safetyStock: 50,
    });

    assert.equal(level, 10 * 14 + 50);
  });

  test("a longer review period raises the level", () => {
    const base = { avgDailyDemand: 10, leadTimeDays: 7, safetyStock: 50 };
    assert.ok(
      orderUpToLevel({ ...base, reviewPeriodDays: 14 }) >
        orderUpToLevel({ ...base, reviewPeriodDays: 7 }),
      "reviewPeriodDays must affect the level - it is the frequency half of the policy",
    );
  });

  test("no demand still holds the buffer", () => {
    assert.equal(
      orderUpToLevel({ avgDailyDemand: 0, leadTimeDays: 7, reviewPeriodDays: 7, safetyStock: 25 }),
      25,
    );
  });

  test("never returns a negative level", () => {
    assert.equal(
      orderUpToLevel({ avgDailyDemand: 0, leadTimeDays: 0, reviewPeriodDays: 0, safetyStock: 0 }),
      0,
    );
  });
});

describe("expectedShortfall", () => {
  test("stock far above demand is effectively no shortfall", () => {
    const shortfall = expectedShortfall({
      demandMean: 100,
      demandStdDev: 10,
      availableUnits: 200,
    });

    assert.ok(shortfall < 0.01, "expected almost no shortfall, got " + shortfall);
  });

  test("holding exactly the mean leaves half a standard deviation of loss", () => {
    // The normal loss function at k=0 is phi(0) = 1/sqrt(2*pi).
    const sigma = 20;
    const shortfall = expectedShortfall({
      demandMean: 100,
      demandStdDev: sigma,
      availableUnits: 100,
    });

    assert.ok(Math.abs(shortfall - sigma * normalPdf(0)) < 1e-6);
  });

  test("falls as stock rises", () => {
    const base = { demandMean: 100, demandStdDev: 25 };
    const low = expectedShortfall({ ...base, availableUnits: 80 });
    const high = expectedShortfall({ ...base, availableUnits: 130 });

    assert.ok(low > high, "more stock must not increase expected shortfall");
  });

  test("certain demand is a plain subtraction", () => {
    assert.equal(
      expectedShortfall({ demandMean: 100, demandStdDev: 0, availableUnits: 60 }),
      40,
    );
    assert.equal(
      expectedShortfall({ demandMean: 100, demandStdDev: 0, availableUnits: 140 }),
      0,
    );
  });

  test("is never negative", () => {
    for (const availableUnits of [0, 50, 100, 250, 1000]) {
      const shortfall = expectedShortfall({ demandMean: 100, demandStdDev: 30, availableUnits });
      assert.ok(shortfall >= 0, "negative shortfall at " + availableUnits);
    }
  });
});

describe("availableStock and inventoryPosition", () => {
  const levels = (onHand: number, reserved: number, inTransit: number) => ({
    onHand,
    reserved,
    inTransit,
  });

  test("available never exceeds what is on the shelf", () => {
    for (const [onHand, reserved, inTransit] of [
      [500, 0, 0],
      [500, 180, 0],
      [500, 180, 900],
      [0, 0, 400],
    ] as const) {
      const stock = levels(onHand, reserved, inTransit);
      assert.ok(
        availableStock(stock) <= onHand,
        `available exceeded on-hand for ${onHand}/${reserved}/${inTransit}`,
      );
    }
  });

  test("inventory position is never below available - inbound stock only ever adds", () => {
    for (const [onHand, reserved, inTransit] of [
      [500, 180, 0],
      [500, 180, 199],
      [100, 90, 1000],
      [0, 0, 0],
    ] as const) {
      const stock = levels(onHand, reserved, inTransit);
      assert.ok(
        inventoryPosition(stock) >= availableStock(stock),
        `position below available for ${onHand}/${reserved}/${inTransit}`,
      );
    }
  });

  test("reserved units do not count as cover", () => {
    // 500 on the shelf but 400 promised away is 100 of cover, not 500.
    assert.equal(availableStock(levels(500, 400, 0)), 100);
  });

  test("an over-commitment floors at zero rather than going negative", () => {
    assert.equal(availableStock(levels(100, 250, 0)), 0);
    assert.equal(inventoryPosition(levels(100, 250, 0)), 0);
  });

  test("inbound stock counts towards the reorder decision", () => {
    // The live case: on-hand 151 against a reorder point of 176 looks short, but 199
    // units are already inbound, so the position is 350 and no order is due.
    const stock = levels(151, 0, 199);
    assert.ok(stock.onHand < 176, "precondition: on-hand alone looks short");
    assert.ok(
      inventoryPosition(stock) >= 176,
      "inbound stock should have cleared the reorder point",
    );
  });

  test("inbound stock does not make an empty shelf available", () => {
    // The distinction that matters: 400 arriving tomorrow serves nobody today.
    const stock = levels(0, 0, 400);
    assert.equal(availableStock(stock), 0);
    assert.equal(inventoryPosition(stock), 400);
  });
});
