import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectEnvelope, expectErrorShape } from "../helpers/assertions.js";
import { prisma } from "../../src/config/prisma.js";

let server: TestServer;

interface Settings {
  general: Record<string, unknown>;
  alerts: Record<string, unknown>;
  [key: string]: unknown;
}

const read = async () =>
  expectEnvelope<Settings>(await server.json("/api/settings")).data;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

describe("GET /api/settings", () => {
  test("seeds defaults on first read and answers in the envelope", async () => {
    const settings = await read();
    assert.ok(settings.general, "the tree must come back whole");
    assert.ok(settings.alerts);
  });
});

describe("PATCH /api/settings", () => {
  test("merges deeply instead of replacing a whole block", async () => {
    const before = await read();
    const generalKeys = Object.keys(before.general).length;
    assert.ok(generalKeys > 1, "this test is only meaningful on a block with siblings");

    const response = await fetch(`${server.url}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ general: { theme: "dark" } }),
    });
    assert.equal(response.status, 200);

    const after = await read();
    assert.equal(after.general.theme, "dark", "the patched field must change");
    assert.equal(
      Object.keys(after.general).length,
      generalKeys,
      "a shallow spread replaced the whole general block and silently dropped its siblings",
    );
  });

  test("leaves untouched blocks completely alone", async () => {
    const before = await read();

    await fetch(`${server.url}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ general: { theme: "light" } }),
    });

    const after = await read();
    assert.deepEqual(after.alerts, before.alerts, "alert settings were not part of the patch");
  });

  test("rejects a body that is not an object", async () => {
    const send = (body: string) =>
      fetch(`${server.url}/api/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body,
      });

    // An array parses as JSON, so it reaches the schema and fails validation there.
    const array = await send("[]");
    assert.equal(array.status, 422);
    expectErrorShape(await array.json(), "VALIDATION_FAILED");

    // A bare scalar never gets that far: express's strict JSON parser refuses a
    // top-level string or number outright, which is the earlier and better place
    // to stop it.
    for (const body of ['"nope"', "42"]) {
      const response = await send(body);
      assert.equal(response.status, 400, `${body} should be refused as malformed`);
      expectErrorShape(await response.json(), "MALFORMED_JSON");
    }
  });

  test("never leaves the system without settings", async () => {
    // The write is delete-then-create; before it was wrapped in a transaction a
    // failure between the two wiped the configuration with no way back.
    await fetch(`${server.url}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ general: { theme: "dark" } }),
    });

    assert.equal(
      await prisma.systemSettings.count(),
      1,
      "exactly one settings row must exist after a write",
    );
  });
});
