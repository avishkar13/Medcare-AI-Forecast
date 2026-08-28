import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
  resolveThresholds,
  widestExpiryWindow,
  type GlobalAlertThresholds,
} from "../../src/utils/alert-thresholds.js";

const GLOBAL: GlobalAlertThresholds = { stockoutProbability: 40, expiryWindow: 30 };

describe("resolveThresholds - minimum stock floor", () => {
  // The floor has no global counterpart on purpose: one unit count across forty SKUs
  // could not be right for any of them. So null means "rule off", never "inherit".
  test("is null when the position sets none", () => {
    for (const override of [undefined, null, {}, { minimumStockUnits: null }]) {
      assert.equal(resolveThresholds(GLOBAL, override).minimumStockUnits, null);
    }
  });

  test("carries the value the position set", () => {
    assert.equal(resolveThresholds(GLOBAL, { minimumStockUnits: 500 }).minimumStockUnits, 500);
  });

  test("a floor of zero is treated as unset rather than as a floor", () => {
    // Zero would arm on a position that is already empty and says nothing the
    // probability rule has not already said.
    assert.equal(resolveThresholds(GLOBAL, { minimumStockUnits: 0 }).minimumStockUnits, null);
  });

  test("setting only the floor leaves both inherited thresholds untouched", () => {
    const resolved = resolveThresholds(GLOBAL, { minimumStockUnits: 250 });
    assert.equal(resolved.stockoutProbability, GLOBAL.stockoutProbability);
    assert.equal(resolved.expiryWindow, GLOBAL.expiryWindow);
    assert.equal(resolved.overridden.stockoutProbability, false);
    assert.equal(resolved.overridden.expiryWindow, false);
  });

  test("the floor does not disturb the other two overrides", () => {
    const resolved = resolveThresholds(GLOBAL, {
      alertStockoutProbability: 15,
      alertExpiryWindowDays: 90,
      minimumStockUnits: 500,
    });
    assert.equal(resolved.stockoutProbability, 15);
    assert.equal(resolved.expiryWindow, 90);
    assert.equal(resolved.minimumStockUnits, 500);
  });
});

describe("resolveThresholds", () => {
  test("no override inherits the global set exactly", () => {
    for (const override of [undefined, null, {}, { alertStockoutProbability: null }]) {
      const resolved = resolveThresholds(GLOBAL, override);
      assert.equal(resolved.stockoutProbability, GLOBAL.stockoutProbability);
      assert.equal(resolved.expiryWindow, GLOBAL.expiryWindow);
    }
  });

  test("an override wins over the global value", () => {
    const resolved = resolveThresholds(GLOBAL, {
      alertStockoutProbability: 15,
      alertExpiryWindowDays: 90,
    });
    assert.equal(resolved.stockoutProbability, 15);
    assert.equal(resolved.expiryWindow, 90);
  });

  test("inheritance is per field, not all or nothing", () => {
    // The failure this guards: treating a partially-filled override as "use the override
    // object" turns the unset field into undefined, and a threshold of 0 fires on every
    // position at once.
    const resolved = resolveThresholds(GLOBAL, { alertExpiryWindowDays: 90 });
    assert.equal(resolved.stockoutProbability, 40, "unset field must fall back");
    assert.equal(resolved.expiryWindow, 90, "set field must win");
  });

  test("zero is a real override, not an absent one", () => {
    // `?? ` on a falsy-but-valid value is the classic bug here: 0% means "alert on any
    // uncovered lead time", which is a legitimate setting for a critical line.
    const resolved = resolveThresholds(GLOBAL, { alertStockoutProbability: 0 });
    assert.equal(resolved.stockoutProbability, 0);
  });

  test("it reports which fields were overridden", () => {
    const inherited = resolveThresholds(GLOBAL, {});
    assert.deepEqual(inherited.overridden, { stockoutProbability: false, expiryWindow: false });

    const partial = resolveThresholds(GLOBAL, { alertStockoutProbability: 15 });
    assert.deepEqual(partial.overridden, { stockoutProbability: true, expiryWindow: false });
  });

  test("resolving is pure - the same inputs always give the same answer", () => {
    const override = { alertStockoutProbability: 15 };
    assert.deepEqual(resolveThresholds(GLOBAL, override), resolveThresholds(GLOBAL, override));
  });
});

describe("widestExpiryWindow", () => {
  test("with no overrides it is the global window", () => {
    assert.equal(widestExpiryWindow(GLOBAL, []), 30);
    assert.equal(widestExpiryWindow(GLOBAL, [{}, { alertExpiryWindowDays: null }]), 30);
  });

  test("it reaches as far as the most generous override", () => {
    const widest = widestExpiryWindow(GLOBAL, [
      { alertExpiryWindowDays: 10 },
      { alertExpiryWindowDays: 120 },
      {},
    ]);
    assert.equal(widest, 120, "a pair asking for 120 days must not be under-served");
  });

  test("a narrower override never shrinks the query below the global window", () => {
    // Narrowing is applied per pair when judging, not to the query - otherwise a pair on
    // the global window would stop seeing its own batches.
    assert.equal(widestExpiryWindow(GLOBAL, [{ alertExpiryWindowDays: 7 }]), 30);
  });

  test("it never returns less than the global window", () => {
    for (const days of [1, 7, 29, 30, 31, 365]) {
      assert.ok(
        widestExpiryWindow(GLOBAL, [{ alertExpiryWindowDays: days }]) >= GLOBAL.expiryWindow,
        `shrank below the global window at ${days}`,
      );
    }
  });
});
