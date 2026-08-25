import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Normalised: a checkout with CRLF endings must not fail assertions about layout.
const read = (path: string) => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");
const has = (path: string) => existsSync(join(root, path));

const dockerfile = read("Dockerfile");
const compose = read("docker-compose.yml");
const entrypoint = read("docker-entrypoint.sh");
const dockerignore = read(".dockerignore");

const built = has("dist");
const skipUnlessBuilt = { skip: built ? false : "run pnpm build first" };

const importsOf = (source: string): string[] =>
  [...source.matchAll(/from\s+["'](\.[^"']+)["']/g)].map((match) => match[1]!);

const collectFiles = (directory: string, extension: string): string[] => {
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(join(root, current), { withFileTypes: true })) {
      const next = join(current, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(extension)) found.push(next);
    }
  };
  walk(directory);
  return found;
};

describe("the image ships everything the container is told to run", skipUnlessBuilt, () => {
  test("the CMD entry point exists in dist", () => {
    assert.match(dockerfile, /dist\/src\/index\.js/, "CMD should launch the compiled entry point");
    assert.ok(has("dist/src/index.js"), "dist/src/index.js is missing");
  });

  test("the entrypoint seeds from the compiled script, not the TypeScript source", () => {
    assert.ok(has("dist/prisma/seed.js"), "dist/prisma/seed.js is missing");
    assert.match(entrypoint, /node dist\/prisma\/seed\.js/, "the entrypoint should run the compiled seed");
    assert.ok(
      !/prisma db seed/.test(entrypoint),
      "prisma db seed runs tsx against prisma/seed.ts, whose ../src import does not exist in the runtime image",
    );
  });

  test("the seed guard script exists and is compiled", () => {
    assert.ok(has("dist/prisma/count-products.js"), "dist/prisma/count-products.js is missing");
    assert.match(entrypoint, /node dist\/prisma\/count-products\.js/);
  });

  test("the generated Prisma client is inside dist, where the compiled code looks for it", () => {
    assert.ok(has("dist/generated/prisma/client.js"), "dist/generated/prisma/client.js is missing");
  });

  test("no compiled file imports a path that escapes dist", () => {
    for (const file of collectFiles("dist", ".js")) {
      for (const specifier of importsOf(read(file))) {
        const target = resolve(root, dirname(file), specifier);
        const outside = relative(join(root, "dist"), target).startsWith("..");
        assert.ok(
          !outside,
          file + " imports " + specifier + ", which resolves outside dist and will not exist in the image",
        );
      }
    }
  });
});

describe("the Dockerfile copies only paths that exist", () => {
  test("every COPY --from=builder source is a real path", () => {
    const sources = [...dockerfile.matchAll(/COPY --from=builder\s+(\S+)\s+\S+/g)].map((match) => match[1]!);
    assert.ok(sources.length > 0, "expected at least one COPY from the builder stage");

    for (const source of sources) {
      const local = source.replace(/^\/app\//, "");
      if (local.startsWith("dist") && !built) continue;
      assert.ok(has(local), "Dockerfile copies " + source + " but " + local + " does not exist");
    }
  });

  test("the entrypoint script is copied and made executable", () => {
    assert.match(dockerfile, /COPY --chmod=0755 docker-entrypoint\.sh/, "entrypoint must be executable");
  });

  test("the entrypoint uses LF endings, which Alpine's shebang requires", () => {
    assert.ok(!entrypoint.includes("\r\n"), "CRLF in the shebang line makes the script unrunnable on Alpine");
    assert.ok(entrypoint.startsWith("#!/bin/sh"), "missing shebang");
  });
});

describe("the runtime stage does not depend on devDependencies", () => {
  test("the schema declares no datasource url, which Prisma 7 rejects", () => {
    assert.ok(
      !/url\s*=\s*env\(/.test(read("prisma/schema.prisma")),
      "Prisma 7 fails validation on a url in the schema: the connection url belongs in the config file",
    );
  });

  test("a runtime config supplies the url migrate deploy needs", () => {
    const copied = /COPY\s+(\S+)\s+\.\/prisma\.config\.js/.exec(dockerfile)?.[1];
    assert.ok(copied, "the runtime stage must ship a prisma.config.js, or migrate deploy has no datasource url");
    assert.ok(has(copied), copied + " does not exist");

    const config = read(copied);
    assert.match(config, /process\.env\.DATABASE_URL/, "the url must come from the container environment");
    assert.ok(
      !/\b(import|require)\b/.test(config),
      "the runtime config must not import anything: prisma/config lives in the devDependencies that --prod excludes",
    );
  });

  test("prisma.config.ts is not shipped, so nothing tries to load it", () => {
    assert.ok(
      !/COPY[^\n]*prisma\.config\.ts/.test(dockerfile),
      "prisma.config.ts imports prisma/config, which is not installed in a --prod runtime",
    );
  });

  test("the Prisma CLI is pinned to the client version", () => {
    const client = JSON.parse(read("package.json")).dependencies["@prisma/client"] as string;
    const version = client.replace(/^[\^~]/, "");
    assert.match(
      dockerfile,
      new RegExp("prisma@" + version.replace(/\./g, "\\.")),
      "the Prisma CLI and @prisma/client must be the same version; found client " + version,
    );
  });

  test("the production install excludes dev dependencies", () => {
    assert.match(dockerfile, /pnpm install --frozen-lockfile --prod/);
  });
});

describe("the container reports its own health", () => {
  test("a HEALTHCHECK is defined against the readiness probe", () => {
    assert.match(dockerfile, /HEALTHCHECK/, "the service that serves traffic should report readiness");
    assert.match(dockerfile, /health\/ready/, "the healthcheck should use the readiness endpoint");
  });

  test("the healthcheck honours PORT and API_PREFIX rather than hardcoding them", () => {
    const directive = /HEALTHCHECK[\s\S]*?\n\n/.exec(dockerfile)?.[0] ?? "";
    assert.match(directive, /\$\{PORT:-4000\}/, "PORT must come from the environment");
    assert.match(directive, /\$\{API_PREFIX:-\/api\}/, "API_PREFIX must come from the environment");
  });

  test("the healthcheck does not call process.exit from inside a fetch callback", () => {
    const directive = /HEALTHCHECK[\s\S]*?\n\n/.exec(dockerfile)?.[0] ?? "";
    assert.ok(
      !/node -e/.test(directive),
      "process.exit() inside a fetch callback races undici socket teardown; observed exit 127 with a libuv assertion while the service was healthy",
    );
    assert.match(directive, /wget/, "busybox wget ships with node:alpine and exits non-zero on an error status");
  });
});

describe("the seed cannot run by accident", () => {
  test("the guard fails closed when the row count cannot be read", () => {
    assert.ok(
      !/\|\|\s*echo\s+["']?0/.test(entrypoint),
      "falling back to 0 on error treats an unreachable database as an empty one, and the seed truncates every table",
    );
    assert.match(entrypoint, /Refusing to seed/, "an unreadable count must skip the seed, not risk it");
  });

  test("the entrypoint aborts on an unset variable as well as an error", () => {
    assert.match(entrypoint, /set -eu/);
  });

  test("RUN_SEED defaults to something explicit rather than being assumed", () => {
    assert.match(entrypoint, /\$\{RUN_SEED:-\w+\}/, "an unset RUN_SEED must have a defined meaning");
  });
});

describe("compose wiring", () => {
  test("the backend waits for its dependencies to be healthy", () => {
    assert.match(compose, /condition:\s*service_healthy/);
    for (const service of ["postgres", "redis"]) {
      assert.ok(compose.includes(service + ":\n        condition: service_healthy"), service + " is not gated");
    }
  });

  test("both datastores define a healthcheck", () => {
    assert.equal((compose.match(/healthcheck:/g) ?? []).length, 2);
  });

  test("Redis requires a password and the url carries it", () => {
    assert.match(compose, /--requirepass/, "an unauthenticated Redis should not be reachable");
    assert.match(compose, /REDIS_URL:\s*redis:\/\/:\$\{REDIS_PASSWORD/, "REDIS_URL must include the password");
  });

  test("datastore ports are bound to loopback, not every interface", () => {
    for (const port of ["5432", "6379"]) {
      assert.ok(
        compose.includes('"127.0.0.1:' + port + ":" + port + '"'),
        port + " is published on all interfaces",
      );
    }
  });

  test("credentials come from the environment with a development fallback", () => {
    for (const variable of ["POSTGRES_PASSWORD", "REDIS_PASSWORD", "POSTGRES_USER"]) {
      assert.ok(compose.includes("${" + variable + ":-"), variable + " is hardcoded");
    }
  });

  test("the database url is composed from the same credentials Postgres is given", () => {
    assert.match(compose, /DATABASE_URL:\s*postgresql:\/\/\$\{POSTGRES_USER/);
    assert.ok(compose.includes("@postgres:5432/"), "the backend must reach Postgres by service name");
  });
});

describe("build context", () => {
  test("excludes everything the image does not need", () => {
    for (const entry of ["node_modules", "dist", "tests", ".git", ".env", "*.md"]) {
      assert.ok(
        dockerignore.split("\n").includes(entry),
        ".dockerignore should exclude " + entry,
      );
    }
  });

  test("does not exclude anything the Dockerfile copies from the context", () => {
    const ignored = dockerignore
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"));

    for (const copied of ["package.json", "pnpm-lock.yaml", "docker-entrypoint.sh"]) {
      assert.ok(!ignored.includes(copied), copied + " is copied by the Dockerfile but excluded from the context");
    }
  });
});
