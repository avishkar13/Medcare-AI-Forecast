import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { expectErrorShape } from "../helpers/assertions.js";

let server: TestServer;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await teardown();
});

describe("error contract", () => {
  test("an unknown path is a 404 in the standard shape", async () => {
    const response = await server.get("/api/does-not-exist");
    assert.equal(response.status, 404);

    const body = expectErrorShape(await response.json(), "NOT_FOUND");
    assert.ok(body.error.message.includes("GET"), "the message should name the method and path");
  });

  test("an unknown path outside the api prefix is also handled", async () => {
    const response = await server.get("/nope");
    assert.equal(response.status, 404);
    expectErrorShape(await response.json(), "NOT_FOUND");
  });

  test("a wrong method on a real path is a 404, not a crash", async () => {
    const response = await fetch(server.url + "/api/products", { method: "DELETE" });
    assert.equal(response.status, 404);
    expectErrorShape(await response.json(), "NOT_FOUND");
  });

  test("validation failures list the offending fields", async () => {
    const response = await server.get("/api/products?page=0&pageSize=999");
    assert.equal(response.status, 422);

    const body = expectErrorShape(await response.json(), "VALIDATION_FAILED");
    const details = body.error.details as { path: string; code: string; message: string }[];
    assert.ok(Array.isArray(details));
    assert.ok(details.length >= 2, "both invalid fields should be reported at once");

    for (const issue of details) {
      assert.equal(typeof issue.path, "string");
      assert.equal(typeof issue.code, "string");
      assert.equal(typeof issue.message, "string");
    }
  });

  test("a successful response carries no error key", async () => {
    const body = (await server.json("/api/health/live")) as Record<string, unknown>;
    assert.ok(!("error" in body));
  });

  test("details are omitted when the error carries no field information", async () => {
    const response = await server.get("/api/products/NOPE");
    const body = expectErrorShape(await response.json(), "NOT_FOUND");
    assert.ok(!("details" in body.error), "a plain 404 should not invent an empty details array");
  });
});

describe("request correlation", () => {
  test("every response carries an x-request-id header", async () => {
    for (const path of ["/api/health/live", "/api/products", "/api/nope"]) {
      const response = await server.get(path);
      assert.ok(response.headers.get("x-request-id"), path + " is missing the header");
    }
  });

  test("the error body requestId matches the response header", async () => {
    const response = await server.get("/api/nope");
    const header = response.headers.get("x-request-id");
    const body = expectErrorShape(await response.json());
    assert.equal(body.error.requestId, header, "a client must be able to correlate the two");
  });

  test("a well-formed incoming request id is preserved", async () => {
    const incoming = "trace-abc123-def456";
    const response = await fetch(server.url + "/api/nope", { headers: { "x-request-id": incoming } });

    assert.equal(response.headers.get("x-request-id"), incoming);
    assert.equal(expectErrorShape(await response.json()).error.requestId, incoming);
  });

  test("a malformed incoming request id is replaced rather than echoed", async () => {
    for (const bad of ["short", "has spaces in it", "x".repeat(200), "semi;colon"]) {
      const response = await fetch(server.url + "/api/nope", { headers: { "x-request-id": bad } });
      const issued = response.headers.get("x-request-id");
      assert.notEqual(issued, bad, "an unvalidated id must not be reflected back");
      assert.ok(issued && issued.length >= 8);
    }
  });

  test("ids differ between requests", async () => {
    const first = (await server.get("/api/health/live")).headers.get("x-request-id");
    const second = (await server.get("/api/health/live")).headers.get("x-request-id");
    assert.notEqual(first, second);
  });
});

describe("malformed request bodies", () => {
  test("unparseable JSON is a 400, not a 500", async () => {
    const response = await fetch(server.url + "/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ this is not json",
    });

    assert.ok([400, 404].includes(response.status), "expected a client error, got " + response.status);
    const body = expectErrorShape(await response.json());
    assert.ok(body.error.code !== "INTERNAL_SERVER_ERROR", "a bad body must not surface as a server fault");
  });
});

describe("security and transport headers", () => {
  test("helmet headers are applied", async () => {
    const response = await server.get("/api/health/live");
    assert.ok(response.headers.get("x-content-type-options"), "expected nosniff");
    assert.equal(response.headers.get("x-powered-by"), null, "express should not advertise itself");
  });

  test("the request id header is exposed to cross-origin callers", async () => {
    const response = await fetch(server.url + "/api/health/live", {
      headers: { origin: "http://localhost:3000" },
    });
    const exposed = response.headers.get("access-control-expose-headers") ?? "";
    assert.ok(exposed.toLowerCase().includes("x-request-id"));
  });
});
