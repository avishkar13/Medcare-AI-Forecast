import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { z } from "zod";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "../../src/utils/errors.js";
import { isValidationError, toErrorDetails, toReadableLines } from "../../src/zod/errors.js";

describe("AppError", () => {
  test("carries status, code and message", () => {
    const error = new AppError(418, "TEAPOT", "I am a teapot");
    assert.equal(error.statusCode, 418);
    assert.equal(error.code, "TEAPOT");
    assert.equal(error.message, "I am a teapot");
    assert.ok(error instanceof Error);
  });

  test("names itself after the concrete subclass", () => {
    assert.equal(new NotFoundError().name, "NotFoundError");
    assert.equal(new ConflictError().name, "ConflictError");
  });

  test("exposes 4xx but not 5xx", () => {
    assert.equal(new BadRequestError().expose, true);
    assert.equal(new NotFoundError().expose, true);
    assert.equal(new ServiceUnavailableError().expose, false);
    assert.equal(new AppError(500, "BOOM", "boom").expose, false);
  });

  test("keeps details undefined unless supplied", () => {
    assert.equal(new BadRequestError("bad").details, undefined);
    assert.deepEqual(new BadRequestError("bad", { field: "sku" }).details, { field: "sku" });
  });

  test("preserves a cause when given one", () => {
    const cause = new Error("underlying");
    assert.equal(new AppError(500, "WRAPPED", "wrapped", { cause }).cause, cause);
  });
});

describe("error subclasses map to the documented status codes", () => {
  const cases: [AppError, number, string][] = [
    [new BadRequestError(), 400, "BAD_REQUEST"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new ConflictError(), 409, "CONFLICT"],
    [new UnprocessableEntityError(), 422, "VALIDATION_FAILED"],
    [new TooManyRequestsError(30), 429, "RATE_LIMIT_EXCEEDED"],
    [new ServiceUnavailableError(), 503, "SERVICE_UNAVAILABLE"],
  ];

  for (const [error, statusCode, code] of cases) {
    test(code + " is " + statusCode, () => {
      assert.equal(error.statusCode, statusCode);
      assert.equal(error.code, code);
    });
  }

  test("TooManyRequestsError reports the retry delay", () => {
    assert.deepEqual(new TooManyRequestsError(42).details, { retryAfterSeconds: 42 });
  });

  test("a custom message overrides the default", () => {
    assert.equal(new NotFoundError("Product 'NOPE' not found").message, "Product 'NOPE' not found");
  });
});

describe("zod error helpers", () => {
  const schema = z.object({
    page: z.coerce.number().int().min(1),
    nested: z.object({ sku: z.string().min(1) }),
  });

  const failure = () => {
    const result = schema.safeParse({ page: 0, nested: { sku: "" } });
    assert.equal(result.success, false);
    return result.error!;
  };

  test("recognises a ZodError and nothing else", () => {
    assert.equal(isValidationError(failure()), true);
    assert.equal(isValidationError(new Error("plain")), false);
    assert.equal(isValidationError(new NotFoundError()), false);
    assert.equal(isValidationError(null), false);
    assert.equal(isValidationError(undefined), false);
  });

  test("flattens issues into path, code and message", () => {
    const details = toErrorDetails(failure()) as { path: string; code: string; message: string }[];
    assert.ok(Array.isArray(details));
    assert.equal(details.length, 2);
    for (const issue of details) {
      assert.equal(typeof issue.path, "string");
      assert.equal(typeof issue.code, "string");
      assert.equal(typeof issue.message, "string");
    }
    assert.ok(details.some((issue) => issue.path === "page"));
    assert.ok(details.some((issue) => issue.path === "nested.sku"), "nested paths join with a dot");
  });

  test("renders readable lines for the startup fail-fast message", () => {
    const lines = toReadableLines(failure());
    assert.ok(lines.includes("page:"));
    assert.ok(lines.includes("nested.sku:"));
    assert.equal(lines.split("\n").length, 2);
  });

  test("labels a root-level issue rather than leaving it blank", () => {
    const rootFailure = z.string().safeParse(42);
    assert.equal(rootFailure.success, false);
    assert.ok(toReadableLines(rootFailure.error!).includes("(root)"));
  });
});
