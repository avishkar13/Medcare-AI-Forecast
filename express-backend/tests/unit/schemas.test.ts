import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
  expiryRiskQuerySchema,
  inventoryHealthQuerySchema,
  networkQuerySchema,
  priorityActionsQuerySchema,
} from "../../src/zod/dashboard.schemas.js";
import {
  productParamsSchema,
  productQuerySchema,
  warehouseQuerySchema,
} from "../../src/zod/masterdata.schemas.js";
import {
  createRunBodySchema,
  idempotencyKeySchema,
  runQuerySchema,
} from "../../src/zod/planning.schemas.js";
import { envSchema } from "../../src/zod/env.schemas.js";

interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: { issues: { path: PropertyKey[] }[] };
}

const parsed = <T>(result: ParseResult<T>): T => {
  assert.ok(result.success, "expected the schema to accept this input");
  return result.data as T;
};

const failedOn = <T>(result: ParseResult<T>, field: string): void => {
  assert.equal(result.success, false, "expected the schema to reject this input");
  const paths = result.error!.issues.map((issue) => issue.path.join("."));
  assert.ok(paths.includes(field), "expected an issue on " + field + ", got " + JSON.stringify(paths));
};

describe("productQuerySchema", () => {
  test("applies pagination defaults to an empty query", () => {
    const value = parsed(productQuerySchema.safeParse({}));
    assert.equal(value.page, 1);
    assert.equal(value.pageSize, 50);
  });

  test("coerces numeric strings, as query strings always arrive", () => {
    const value = parsed(productQuerySchema.safeParse({ page: "3", pageSize: "25" }));
    assert.equal(value.page, 3);
    assert.equal(value.pageSize, 25);
  });

  test("rejects a page below one", () => {
    failedOn(productQuerySchema.safeParse({ page: "0" }), "page");
    failedOn(productQuerySchema.safeParse({ page: "-1" }), "page");
  });

  test("rejects fractional pagination", () => {
    failedOn(productQuerySchema.safeParse({ page: "1.5" }), "page");
  });

  test("accepts pageSize at the cap and rejects one above", () => {
    assert.equal(parsed(productQuerySchema.safeParse({ pageSize: "200" })).pageSize, 200);
    failedOn(productQuerySchema.safeParse({ pageSize: "201" }), "pageSize");
  });

  test("accepts every Criticality value and rejects anything else", () => {
    for (const level of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) {
      assert.equal(parsed(productQuerySchema.safeParse({ criticality: level })).criticality, level);
    }
    failedOn(productQuerySchema.safeParse({ criticality: "URGENT" }), "criticality");
    failedOn(productQuerySchema.safeParse({ criticality: "critical" }), "criticality");
  });

  test("reads booleans from their query-string spellings", () => {
    for (const truthy of ["true", "1", "yes"]) {
      assert.equal(parsed(productQuerySchema.safeParse({ isActive: truthy })).isActive, true);
    }
    for (const falsy of ["false", "0", "no"]) {
      assert.equal(parsed(productQuerySchema.safeParse({ isActive: falsy })).isActive, false);
    }
  });

  test("trims search terms and rejects blank ones", () => {
    assert.equal(parsed(productQuerySchema.safeParse({ search: "  lisi  " })).search, "lisi");
    failedOn(productQuerySchema.safeParse({ search: "   " }), "search");
  });
});

describe("productParamsSchema", () => {
  test("accepts a cuid or a sku", () => {
    assert.equal(parsed(productParamsSchema.safeParse({ id: "SKU-LIS-10" })).id, "SKU-LIS-10");
    assert.equal(parsed(productParamsSchema.safeParse({ id: "cmt6kuign0007" })).id, "cmt6kuign0007");
  });

  test("rejects an empty identifier", () => {
    failedOn(productParamsSchema.safeParse({ id: "" }), "id");
  });
});

describe("warehouseQuerySchema", () => {
  test("accepts every tier and rejects anything else", () => {
    for (const tier of ["METRO", "TIER_1", "TIER_2", "TIER_3"]) {
      assert.equal(parsed(warehouseQuerySchema.safeParse({ tier })).tier, tier);
    }
    failedOn(warehouseQuerySchema.safeParse({ tier: "TIER_9" }), "tier");
  });

  test("leaves filters undefined when absent", () => {
    const value = parsed(warehouseQuerySchema.safeParse({}));
    assert.equal(value.tier, undefined);
    assert.equal(value.region, undefined);
    assert.equal(value.isActive, undefined);
  });
});

describe("networkQuerySchema", () => {
  test("accepts an optional tier", () => {
    assert.equal(parsed(networkQuerySchema.safeParse({})).tier, undefined);
    assert.equal(parsed(networkQuerySchema.safeParse({ tier: "METRO" })).tier, "METRO");
    failedOn(networkQuerySchema.safeParse({ tier: "BOGUS" }), "tier");
  });
});

describe("inventoryHealthQuerySchema", () => {
  test("treats a blank warehouseId as invalid rather than absent", () => {
    assert.equal(parsed(inventoryHealthQuerySchema.safeParse({})).warehouseId, undefined);
    failedOn(inventoryHealthQuerySchema.safeParse({ warehouseId: "" }), "warehouseId");
  });
});

describe("expiryRiskQuerySchema", () => {
  test("defaults the horizon and page size", () => {
    const value = parsed(expiryRiskQuerySchema.safeParse({}));
    assert.equal(value.withinDays, 90);
    assert.equal(value.page, 1);
    assert.equal(value.pageSize, 20);
  });

  test("bounds the horizon to a year", () => {
    assert.equal(parsed(expiryRiskQuerySchema.safeParse({ withinDays: "1" })).withinDays, 1);
    assert.equal(parsed(expiryRiskQuerySchema.safeParse({ withinDays: "365" })).withinDays, 365);
    failedOn(expiryRiskQuerySchema.safeParse({ withinDays: "0" }), "withinDays");
    failedOn(expiryRiskQuerySchema.safeParse({ withinDays: "366" }), "withinDays");
    failedOn(expiryRiskQuerySchema.safeParse({ withinDays: "abc" }), "withinDays");
  });

  test("accepts the four severity bands and is case sensitive", () => {
    for (const severity of ["critical", "high", "medium", "low"]) {
      assert.equal(parsed(expiryRiskQuerySchema.safeParse({ severity })).severity, severity);
    }
    failedOn(expiryRiskQuerySchema.safeParse({ severity: "CRITICAL" }), "severity");
  });

  test("caps pageSize at 100", () => {
    assert.equal(parsed(expiryRiskQuerySchema.safeParse({ pageSize: "100" })).pageSize, 100);
    failedOn(expiryRiskQuerySchema.safeParse({ pageSize: "101" }), "pageSize");
  });
});

describe("priorityActionsQuerySchema", () => {
  test("defaults the limit to ten", () => {
    assert.equal(parsed(priorityActionsQuerySchema.safeParse({})).limit, 10);
  });

  test("caps the limit at fifty", () => {
    assert.equal(parsed(priorityActionsQuerySchema.safeParse({ limit: "50" })).limit, 50);
    failedOn(priorityActionsQuerySchema.safeParse({ limit: "51" }), "limit");
    failedOn(priorityActionsQuerySchema.safeParse({ limit: "0" }), "limit");
  });

  test("accepts every action type and rejects anything else", () => {
    const types = [
      "TRANSFER_OPPORTUNITY",
      "STOCKOUT_IMMINENT",
      "BELOW_REORDER_POINT",
      "EXPIRY_WRITE_OFF",
      "EXCESS_STOCK",
    ];
    for (const type of types) {
      assert.equal(parsed(priorityActionsQuerySchema.safeParse({ type })).type, type);
    }
    failedOn(priorityActionsQuerySchema.safeParse({ type: "BOGUS" }), "type");
  });
});

describe("createRunBodySchema", () => {
  test("defaults the horizon on an empty body", () => {
    const value = parsed(createRunBodySchema.safeParse({}));
    assert.equal(value.horizonDays, 30);
    assert.equal(value.scenarioId, undefined);
    assert.equal(value.modelVersion, undefined);
  });

  test("rejects a horizon outside one full year", () => {
    failedOn(createRunBodySchema.safeParse({ horizonDays: 0 }), "horizonDays");
    failedOn(createRunBodySchema.safeParse({ horizonDays: 366 }), "horizonDays");
  });

  test("rejects a fractional horizon", () => {
    failedOn(createRunBodySchema.safeParse({ horizonDays: 30.5 }), "horizonDays");
  });

  test("does not coerce, because a JSON body is typed unlike a query string", () => {
    failedOn(createRunBodySchema.safeParse({ horizonDays: "30" }), "horizonDays");
  });

  test("rejects an unknown field instead of dropping it", () => {
    assert.equal(createRunBodySchema.safeParse({ iterations: 1000 }).success, false);
  });
});

describe("runQuerySchema", () => {
  test("applies pagination defaults", () => {
    const value = parsed(runQuerySchema.safeParse({}));
    assert.equal(value.page, 1);
    assert.equal(value.pageSize, 20);
  });

  test("accepts every status the schema declares", () => {
    for (const status of ["PENDING", "RUNNING", "COMPLETED", "FAILED"]) {
      assert.equal(runQuerySchema.safeParse({ status }).success, true, status + " should be accepted");
    }
  });

  test("rejects a status the schema does not declare", () => {
    failedOn(runQuerySchema.safeParse({ status: "ABANDONED" }), "status");
  });

  test("caps pageSize at one hundred", () => {
    failedOn(runQuerySchema.safeParse({ pageSize: "500" }), "pageSize");
  });
});

describe("idempotencyKeySchema", () => {
  test("accepts a key long enough to be unique", () => {
    assert.equal(idempotencyKeySchema.safeParse("run-2026-08-25-001").success, true);
  });

  test("rejects a key too short to be unique", () => {
    assert.equal(idempotencyKeySchema.safeParse("short").success, false);
  });

  test("rejects characters that would not survive a header round trip", () => {
    assert.equal(idempotencyKeySchema.safeParse("key with spaces").success, false);
    assert.equal(idempotencyKeySchema.safeParse("key/with/slashes").success, false);
  });
});

describe("envSchema", () => {
  const base = {
    DATABASE_URL: "postgresql://localhost:5432/db",
    JWT_SECRET: "a-development-secret-of-at-least-32-chars",
  };

  test("applies server defaults", () => {
    const value = parsed(envSchema.safeParse(base));
    assert.equal(value.NODE_ENV, "development");
    assert.equal(value.PORT, 4000);
    assert.equal(value.API_PREFIX, "/api");
    assert.equal(value.RATE_LIMIT_ENABLED, true);
  });

  test("requires a database url", () => {
    failedOn(envSchema.safeParse({}), "DATABASE_URL");
  });

  test("rejects a port outside the valid range", () => {
    failedOn(envSchema.safeParse({ ...base, PORT: "70000" }), "PORT");
    failedOn(envSchema.safeParse({ ...base, PORT: "0" }), "PORT");
  });

  test("rejects an api prefix that does not start with a slash", () => {
    failedOn(envSchema.safeParse({ ...base, API_PREFIX: "api" }), "API_PREFIX");
  });

  /** Everything a production boot needs beyond the development baseline. */
  const production = {
    ...base,
    NODE_ENV: "production",
    REDIS_URL: "redis://localhost:6379",
    TRAINING_API_KEY: "a-service-key",
  };

  test("requires Redis in production so limits are shared across instances", () => {
    const { REDIS_URL: _omitted, ...withoutRedis } = production;
    failedOn(envSchema.safeParse(withoutRedis), "REDIS_URL");
    assert.ok(envSchema.safeParse(production).success);
  });

  /**
   * `/api/training-data` is gated on this key rather than on RBAC, so an unset key in
   * production would leave the whole demand history readable by anyone who finds the
   * route. Refusing to boot is the only safe reading.
   */
  test("requires a training service key in production", () => {
    const { TRAINING_API_KEY: _omitted, ...withoutKey } = production;
    failedOn(envSchema.safeParse(withoutKey), "TRAINING_API_KEY");
    assert.ok(envSchema.safeParse(production).success);
  });

  test("allows a development instance with no Redis", () => {
    assert.ok(envSchema.safeParse({ ...base, NODE_ENV: "development" }).success);
  });
});
