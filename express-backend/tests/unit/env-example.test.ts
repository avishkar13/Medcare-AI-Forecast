import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import { envSchema } from "../../src/zod/env.schemas.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const example = read(".env.example");

const entries = example
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const separator = line.indexOf("=");
    assert.notEqual(separator, -1, "malformed line without '=': " + line);
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] as const;
  });

const documented = new Map(entries);

const schemaKeys = [
  ...read("src/zod/env.schemas.ts").matchAll(/^ {4}([A-Z0-9_]+):/gm),
].map((match) => match[1]!);

describe(".env.example", () => {
  test("is itself a valid configuration", () => {
    const result = envSchema.safeParse(Object.fromEntries(documented));
    const issues = result.success
      ? ""
      : result.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; ");
    assert.ok(result.success, "the example does not satisfy its own schema: " + issues);
  });

  test("documents every variable the schema reads", () => {
    for (const key of schemaKeys) {
      assert.ok(documented.has(key), key + " is read by the app but absent from .env.example");
    }
  });

  test("documents no variable the app does not read, except those it declares as compose-only", () => {
    const composeOnly = new Set(["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "REDIS_PASSWORD", "RUN_SEED"]);
    for (const [key] of documented) {
      assert.ok(
        schemaKeys.includes(key) || composeOnly.has(key),
        key + " is documented but neither the schema nor compose reads it",
      );
    }
  });

  test("documents every variable docker-compose.yml interpolates", () => {
    const referenced = [...read("docker-compose.yml").matchAll(/\$\{([A-Z0-9_]+)/g)].map((match) => match[1]!);
    for (const key of new Set(referenced)) {
      assert.ok(documented.has(key), key + " is interpolated by docker-compose.yml but undocumented");
    }
  });

  test("documents every variable the entrypoint reads", () => {
    const referenced = [...read("docker-entrypoint.sh").matchAll(/\$\{([A-Z0-9_]+):-/g)].map((match) => match[1]!);
    for (const key of new Set(referenced)) {
      assert.ok(documented.has(key), key + " is read by docker-entrypoint.sh but undocumented");
    }
  });

  test("uses boolean spellings the env schema actually accepts", () => {
    const accepted = new Set(["true", "false", "1", "0"]);
    for (const key of ["CORS_CREDENTIALS", "RATE_LIMIT_ENABLED", "RUN_SEED"]) {
      const value = documented.get(key);
      assert.ok(value !== undefined, key + " is missing");
      assert.ok(
        accepted.has(value),
        key + '="' + value + '" is not one of true/false/1/0; the env schema rejects yes/no/on/off',
      );
    }
  });

  test("carries no real credentials", () => {
    const url = documented.get("DATABASE_URL") ?? "";
    assert.ok(url.includes("localhost"), "the example DATABASE_URL should point at localhost");
    assert.ok(
      !/(neon|amazonaws|azure|supabase|render|railway)\.(tech|com|io|app)/i.test(example),
      "a managed-host domain in the example suggests a real connection string was pasted in",
    );
  });

  test("warns that Redis is mandatory in production", () => {
    assert.match(example, /Required when NODE_ENV=production/i);
  });
});
