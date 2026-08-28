import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { app, teardown } from "../helpers/app.js";
import { startServer, type TestServer } from "../helpers/server.js";

/**
 * The three CSV exports E1 asks for as output.
 *
 * The assertions are deliberately **cross-route**: each file is checked against the
 * JSON list route it claims to be a copy of. A test that only asserted "a CSV came
 * back" would pass just as happily on a file built from a different query, and the
 * whole point of the design is that the export and the screen cannot disagree.
 */

let server: TestServer;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  if (server) await server.close();
  await teardown();
});

/** The envelope these list routes answer with, narrowed to what this suite reads. */
interface ListEnvelope {
  data: unknown;
  meta: { total: number };
}

const listJson = async (response: Response): Promise<ListEnvelope> =>
  (await response.json()) as ListEnvelope;

/** Row count excluding the header, tolerant of the trailing newline. */
const dataRows = (body: string) => body.trim().split("\r\n").length - 1;

const header = (body: string) => body.split("\r\n")[0]!;

const EXPORTS = [
  {
    name: "low-stock alert log",
    path: "/api/alerts/export",
    listPath: "/api/alerts",
    filename: "low-stock-alert-log",
    firstColumn: "Detected at",
    filterParam: "sku",
  },
  {
    name: "item-wise stock view",
    path: "/api/inventory/export",
    listPath: "/api/inventory",
    filename: "item-wise-stock-view",
    firstColumn: "SKU",
    // Inventory's free-text filter is `search`; it has no `sku` parameter.
    filterParam: "search",
  },
  {
    name: "reorder action summary",
    path: "/api/recommendations/export",
    listPath: "/api/recommendations",
    filename: "reorder-action-summary",
    firstColumn: "Created at",
    filterParam: "sku",
  },
] as const;

describe("CSV exports", () => {
  for (const spec of EXPORTS) {
    describe(spec.name, () => {
      test("answers as an attachment with a dated csv filename", async () => {
        const response = await server.get(spec.path);

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /text\/csv/);

        const disposition = response.headers.get("content-disposition") ?? "";
        assert.match(disposition, /^attachment; filename="/);
        assert.match(disposition, new RegExp(`${spec.filename}-\\d{4}-\\d{2}-\\d{2}\\.csv`));
      });

      test("leads with the documented header row", async () => {
        const body = await (await server.get(spec.path)).text();
        assert.equal(header(body).split(",")[0], spec.firstColumn);
      });

      test("the row-count header agrees with the file itself", async () => {
        // This is what lets a client detect a truncated download, so it has to be
        // the real count and not the page size.
        const response = await server.get(spec.path);
        const body = await response.text();

        assert.equal(Number(response.headers.get("x-export-rows")), dataRows(body));
      });

      test("exports every row the list route reports, not one page of them", async () => {
        const listed = await listJson(await server.get(`${spec.listPath}?pageSize=1`));
        const total = listed.meta.total;

        const body = await (await server.get(spec.path)).text();

        // The list was asked for a single row; the export must still carry all of them.
        assert.equal(dataRows(body), total);
      });

      test("a filter narrows the file exactly as it narrows the list", async () => {
        // `pageSize=1` keeps the list cheap; `meta.total` is the count that matters.
        const listed = await listJson(await server.get(`${spec.listPath}?pageSize=1`));
        // Inventory answers with a report object rather than a bare array, because it
        // carries network totals alongside the page. Both shapes are unwrapped here.
        const data = listed.data;
        const rows: unknown[] = Array.isArray(data)
          ? data
          : ((data as { items?: unknown[] })?.items ?? []);
        if (listed.meta.total === 0 || rows.length === 0) return;

        const sku = (rows[0] as { sku?: string }).sku;
        assert.ok(sku, "the first listed row should carry a sku to filter on");

        const filter = `${spec.filterParam}=${encodeURIComponent(sku)}`;
        const filteredList = await listJson(
          await server.get(`${spec.listPath}?${filter}&pageSize=1`),
        );
        const filteredBody = await (await server.get(`${spec.path}?${filter}`)).text();

        assert.equal(dataRows(filteredBody), filteredList.meta.total);
      });

      test("treats an unknown parameter exactly as its list route does", async () => {
        // The list schemas are non-strict, so an unknown key is stripped rather than
        // rejected. What matters is that the export does not diverge from the screen:
        // asserting a stricter contract here would be inventing one for exports alone.
        const listResponse = await server.get(`${spec.listPath}?notAFilter=1&pageSize=1`);
        const exportResponse = await server.get(`${spec.path}?notAFilter=1`);

        assert.equal(exportResponse.status, listResponse.status);

        const total = (await listJson(listResponse)).meta.total;
        assert.equal(dataRows(await exportResponse.text()), total);
      });
    });
  }
});
