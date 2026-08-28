import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { ALERT_TYPES, ALERT_TYPE_LABELS, isAlertType } from "../../src/utils/alert-types.js";

/**
 * The guard for a bug that shipped silently and stayed shipped.
 *
 * `routeAlert` selects a rule with `rules.find(entry => entry.event === alert.type)`
 * and then falls back to `rule?.email ?? false`. The seeded rules were named "Critical
 * Stockout" while the detector emitted `stockout_risk`, so the lookup never matched,
 * the fallback disabled email and SMS on every alert ever raised, and nothing failed -
 * in-app kept working because *its* fallback is `true`.
 *
 * Nothing about that is visible in a type check: both sides are strings. These read the
 * two files and assert the vocabularies agree.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const settingsSource = read("../../src/services/settings.service.ts");
const detectorSource = read("../../src/services/alert-detector.service.ts");

/** The `event:` values in DEFAULT_SETTINGS' notification rules. */
const ruleEvents = [...settingsSource.matchAll(/\{\s*event:\s*"([^"]+)"/g)].map((m) => m[1]!);

/** The `type: "..."` literals the detectors actually attach to a draft. */
const emittedTypes = [
  ...new Set([...detectorSource.matchAll(/^\s*type:\s*"([a-z_]+)",/gm)].map((m) => m[1]!)),
];

describe("notification rules match the alerts they are meant to route", () => {
  test("the default rules are keyed on real alert types, not display labels", () => {
    assert.ok(ruleEvents.length > 0, "no notification rules found in DEFAULT_SETTINGS");

    for (const event of ruleEvents) {
      assert.ok(
        isAlertType(event),
        `rule event "${event}" is not an alert type — routeAlert will never match it, ` +
          `and email and SMS will silently default to off`,
      );
    }
  });

  test("every type a detector emits has a rule", () => {
    // Without this, a new detector ships with no rule to find and its alerts quietly
    // reach in-app only — which is how three of the six types behaved.
    for (const type of emittedTypes) {
      assert.ok(
        ruleEvents.includes(type),
        `the detector emits "${type}" but no notification rule covers it`,
      );
    }
  });

  test("the canonical list and the detector agree in both directions", () => {
    for (const type of emittedTypes) {
      assert.ok(isAlertType(type), `detector emits "${type}", missing from ALERT_TYPES`);
    }
    for (const type of ALERT_TYPES) {
      assert.ok(
        emittedTypes.includes(type),
        `ALERT_TYPES lists "${type}" but no detector emits it`,
      );
    }
  });

  test("every type has a label, so the settings table never shows a raw key", () => {
    for (const type of ALERT_TYPES) {
      const label = ALERT_TYPE_LABELS[type];
      assert.ok(label && label !== type, `"${type}" has no readable label`);
    }
  });
});
