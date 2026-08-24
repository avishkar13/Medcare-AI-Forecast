import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import type { Response } from "express";
import { ok, paginated } from "../../src/utils/response.js";
import { isIsoDate } from "../helpers/assertions.js";

interface Captured {
  data: unknown;
  meta: { generatedAt: string; page?: number; pageSize?: number; total?: number; planningRunId?: string | null };
}

const fakeResponse = () => {
  const captured: { body?: Captured } = {};
  const res = {
    json(body: Captured) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, captured };
};

describe("ok", () => {
  test("wraps the payload under data", () => {
    const { res, captured } = fakeResponse();
    ok(res, { sku: "SKU-LIS-10" });
    assert.deepEqual(captured.body!.data, { sku: "SKU-LIS-10" });
  });

  test("always stamps an ISO generatedAt", () => {
    const { res, captured } = fakeResponse();
    ok(res, []);
    assert.ok(isIsoDate(captured.body!.meta.generatedAt));
  });

  test("preserves arrays rather than converting them to objects", () => {
    const { res, captured } = fakeResponse();
    ok(res, [1, 2, 3]);
    assert.ok(Array.isArray(captured.body!.data));
    assert.deepEqual(captured.body!.data, [1, 2, 3]);
  });

  test("carries null through, for routes with no result yet", () => {
    const { res, captured } = fakeResponse();
    ok(res, null);
    assert.equal(captured.body!.data, null);
    assert.ok("data" in captured.body!, "the data key must exist even when null");
  });

  test("merges extra meta alongside generatedAt", () => {
    const { res, captured } = fakeResponse();
    ok(res, [], { planningRunId: null });
    assert.equal(captured.body!.meta.planningRunId, null);
    assert.ok(isIsoDate(captured.body!.meta.generatedAt));
  });

  test("returns the response so a controller can chain", () => {
    const { res } = fakeResponse();
    assert.equal(ok(res, {}), res);
  });
});

describe("paginated", () => {
  test("reports page, pageSize and the filter-wide total", () => {
    const { res, captured } = fakeResponse();
    paginated(res, [{ id: "a" }], 2, 25, 133);
    assert.equal(captured.body!.meta.page, 2);
    assert.equal(captured.body!.meta.pageSize, 25);
    assert.equal(captured.body!.meta.total, 133);
  });

  test("keeps the total independent of the page length", () => {
    const { res, captured } = fakeResponse();
    paginated(res, [{ id: "a" }, { id: "b" }], 1, 50, 400);
    assert.equal((captured.body!.data as unknown[]).length, 2);
    assert.equal(captured.body!.meta.total, 400, "total describes the filter, not the page");
  });

  test("handles an empty page without losing its metadata", () => {
    const { res, captured } = fakeResponse();
    paginated(res, [], 9, 20, 5);
    assert.deepEqual(captured.body!.data, []);
    assert.equal(captured.body!.meta.page, 9);
    assert.equal(captured.body!.meta.total, 5);
  });

  test("still stamps generatedAt", () => {
    const { res, captured } = fakeResponse();
    paginated(res, [], 1, 20, 0);
    assert.ok(isIsoDate(captured.body!.meta.generatedAt));
  });
});
