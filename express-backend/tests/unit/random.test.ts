import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { between, createRng, intBetween } from "../../src/utils/random.js";

const SEED = 0x2f6e2b1;

describe("createRng", () => {
  test("is deterministic for a given seed", () => {
    const left = createRng(SEED);
    const right = createRng(SEED);

    for (let index = 0; index < 200; index += 1) {
      assert.equal(left(), right(), "diverged at draw " + index);
    }
  });

  test("different seeds produce different streams", () => {
    const left = createRng(1);
    const right = createRng(2);
    const drawsLeft = Array.from({ length: 50 }, left);
    const drawsRight = Array.from({ length: 50 }, right);

    assert.notDeepEqual(drawsLeft, drawsRight);
  });

  test("stays inside [0, 1)", () => {
    const rng = createRng(SEED);

    for (let index = 0; index < 10_000; index += 1) {
      const draw = rng();
      assert.ok(draw >= 0 && draw < 1, "out of range at draw " + index + ": " + draw);
    }
  });

  test("reproduces the exact stream the seed script depends on", () => {
    // Pinned so lifting the generator out of prisma/seed.ts cannot silently
    // change the dataset every invariant-based test is written against.
    const rng = createRng(SEED);
    const first = Array.from({ length: 4 }, () => Number(rng().toFixed(12)));

    assert.deepEqual(first, [0.085389830405, 0.522045803024, 0.901566547574, 0.328534793807]);
  });

  test("does not drift over a long stream", () => {
    const rng = createRng(SEED);
    let sum = 0;
    const draws = 100_000;

    for (let index = 0; index < draws; index += 1) sum += rng();

    const mean = sum / draws;
    assert.ok(Math.abs(mean - 0.5) < 0.01, "mean drifted to " + mean);
  });
});

describe("between", () => {
  test("stays within its bounds", () => {
    const rng = createRng(SEED);

    for (let index = 0; index < 1_000; index += 1) {
      const value = between(rng, 5, 9);
      assert.ok(value >= 5 && value < 9, "out of range: " + value);
    }
  });

  test("a zero-width range is that value", () => {
    assert.equal(between(createRng(SEED), 3, 3), 3);
  });
});

describe("intBetween", () => {
  test("is inclusive at both ends", () => {
    const rng = createRng(SEED);
    const seen = new Set<number>();

    for (let index = 0; index < 2_000; index += 1) seen.add(intBetween(rng, 1, 4));

    assert.deepEqual([...seen].sort(), [1, 2, 3, 4], "every endpoint must be reachable");
  });

  test("returns integers", () => {
    const rng = createRng(SEED);

    for (let index = 0; index < 500; index += 1) {
      assert.ok(Number.isInteger(intBetween(rng, 40, 320)));
    }
  });
});
