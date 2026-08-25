import { strict as assert } from "node:assert";

export interface Envelope<T> {
  data: T;
  meta: { generatedAt: string; planningRunId?: string | null; page?: number; pageSize?: number; total?: number };
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown; requestId: string };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const isIsoDate = (value: unknown): boolean =>
  typeof value === "string" && ISO.test(value) && !Number.isNaN(Date.parse(value));

export const expectEnvelope = <T>(body: unknown): Envelope<T> => {
  const envelope = body as Envelope<T>;
  assert.ok(envelope, "response body is empty");
  assert.ok("data" in envelope, "response is missing 'data'");
  assert.ok(envelope.meta, "response is missing 'meta'");
  assert.ok(isIsoDate(envelope.meta.generatedAt), `meta.generatedAt is not ISO: ${envelope.meta.generatedAt}`);
  return envelope;
};

export const expectErrorShape = (body: unknown, code?: string): ErrorBody => {
  const payload = body as ErrorBody;
  assert.ok(payload?.error, "response is missing 'error'");
  assert.equal(typeof payload.error.code, "string");
  assert.equal(typeof payload.error.message, "string");
  assert.equal(typeof payload.error.requestId, "string");
  assert.ok(payload.error.requestId.length > 0, "requestId is empty");
  if (code) assert.equal(payload.error.code, code);
  return payload;
};

export const expectSortedBy = <T>(
  rows: T[],
  value: (row: T) => number,
  direction: "asc" | "desc" = "asc",
): void => {
  for (let index = 1; index < rows.length; index += 1) {
    const previous = value(rows[index - 1]!);
    const current = value(rows[index]!);
    if (direction === "asc") assert.ok(previous <= current, `not ascending at ${index}: ${previous} > ${current}`);
    else assert.ok(previous >= current, `not descending at ${index}: ${previous} < ${current}`);
  }
};

export const closeTo = (actual: number, expected: number, tolerance = 1e-6): void => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};
