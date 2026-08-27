import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { currencyCodeOf, moneyFormatter } from "../../src/utils/currency.js";

describe("currencyCodeOf", () => {
  test("takes the code out of the stored display label", () => {
    assert.equal(currencyCodeOf("INR (₹)"), "INR");
    assert.equal(currencyCodeOf("USD ($)"), "USD");
    assert.equal(currencyCodeOf("EUR (€)"), "EUR");
  });

  test("accepts a bare code", () => {
    assert.equal(currencyCodeOf("GBP"), "GBP");
    assert.equal(currencyCodeOf("  jpy  "), "JPY");
  });

  /**
   * The frontend falls back to USD on the same value (`hooks/use-formatters.ts`), so
   * matching it is what stops the two halves disagreeing about a bad setting.
   */
  test("falls back to USD on anything unusable", () => {
    assert.equal(currencyCodeOf(null), "USD");
    assert.equal(currencyCodeOf(undefined), "USD");
    assert.equal(currencyCodeOf(""), "USD");
    assert.equal(currencyCodeOf("rupees"), "USD");
  });
});

describe("moneyFormatter", () => {
  /** The bug: a hardcoded `$` on a workspace configured for INR. */
  test("uses the configured currency rather than a hardcoded symbol", () => {
    const rupees = moneyFormatter("INR (₹)")(3962);
    assert.ok(rupees.includes("₹"), `expected a rupee symbol, got ${rupees}`);
    assert.ok(!rupees.includes("$"), `expected no dollar sign, got ${rupees}`);

    const dollars = moneyFormatter("USD ($)")(3962);
    assert.ok(dollars.includes("$"), `expected a dollar sign, got ${dollars}`);
  });

  /** Indian grouping is lakh/crore, not thousands. */
  test("groups INR the Indian way", () => {
    assert.equal(moneyFormatter("INR (₹)")(4_902_600).replace(/ /g, " "), "₹49,02,600");
    assert.equal(moneyFormatter("USD ($)")(4_902_600), "$4,902,600");
  });

  test("rounds to whole units", () => {
    assert.equal(moneyFormatter("USD ($)")(3961.62), "$3,962");
    assert.equal(moneyFormatter("USD ($)")(0.4), "$0");
  });

  test("handles zero and negatives without throwing", () => {
    assert.equal(moneyFormatter("USD ($)")(0), "$0");
    assert.ok(moneyFormatter("USD ($)")(-250).includes("250"));
  });

  /**
   * A settings typo must not take a detection cycle down. `Intl.NumberFormat` throws
   * on an unknown ISO code rather than degrading, so the fallback is deliberate.
   */
  test("degrades to a plain number rather than throwing on an unknown code", () => {
    const format = moneyFormatter("XYZ (?)");
    assert.doesNotThrow(() => format(1234));
    assert.ok(format(1234).includes("1,234"));
  });
});
