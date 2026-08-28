import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { attachmentHeader, csvCell, csvFile, csvRow } from "../../src/utils/csv.js";

describe("csvCell", () => {
  test("plain text passes through unquoted", () => {
    assert.equal(csvCell("SKU-1041"), "SKU-1041");
  });

  test("null and undefined are blank, not the words", () => {
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(undefined), "");
  });

  test("a comma forces quoting", () => {
    assert.equal(csvCell("Delhi, NCR"), '"Delhi, NCR"');
  });

  test("a quote is doubled and the cell is wrapped", () => {
    assert.equal(csvCell('he said "go"'), '"he said ""go"""');
  });

  test("a newline forces quoting rather than breaking the row", () => {
    assert.equal(csvCell("line one\nline two"), '"line one\nline two"');
  });

  test("numbers render without quotes; non-finite renders blank", () => {
    assert.equal(csvCell(1250.5), "1250.5");
    assert.equal(csvCell(Number.NaN), "");
    assert.equal(csvCell(Number.POSITIVE_INFINITY), "");
  });

  test("a date renders as an ISO timestamp", () => {
    assert.equal(csvCell(new Date("2026-08-28T00:00:00.000Z")), "2026-08-28T00:00:00.000Z");
  });
});

describe("csvCell - formula injection", () => {
  // These files carry free-text reason and notes fields. A cell starting with = is
  // executed on open in Excel and Sheets.
  test("a leading = is neutralised", () => {
    assert.equal(csvCell("=1+1"), "'=1+1");
  });

  test("the other trigger characters are neutralised too", () => {
    assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(csvCell("+1234"), "'+1234");
  });

  test("a negative number is left alone - it is a number, not a formula", () => {
    assert.equal(csvCell(-180), "-180");
    assert.equal(csvCell("-180"), "-180");
  });

  test("a guarded cell that also needs quoting gets both", () => {
    assert.equal(csvCell("=cmd,exec"), `"'=cmd,exec"`);
  });
});

describe("csvRow and csvFile", () => {
  test("a row joins cells with commas", () => {
    assert.equal(csvRow(["a", 1, null]), "a,1,");
  });

  test("a file puts the header first and ends with a newline", () => {
    const file = csvFile(["sku", "qty"], [["SKU-1", 10], ["SKU-2", 20]]);
    assert.equal(file, "sku,qty\r\nSKU-1,10\r\nSKU-2,20\r\n");
  });

  test("a file with no rows is still a valid one-line file", () => {
    assert.equal(csvFile(["sku", "qty"], []), "sku,qty\r\n");
  });

  test("CRLF, because Excel renders a lone LF as one unbroken line", () => {
    assert.ok(csvFile(["a"], [["b"]]).includes("\r\n"));
  });
});

describe("attachmentHeader", () => {
  test("names the file and dates it", () => {
    assert.equal(
      attachmentHeader("low-stock-alerts", new Date("2026-08-28T10:00:00.000Z")),
      'attachment; filename="low-stock-alerts-2026-08-28.csv"',
    );
  });

  test("strips anything that could break the header", () => {
    const header = attachmentHeader('bad"name\nhere', new Date("2026-08-28T00:00:00.000Z"));
    assert.ok(!header.includes("\n"));
    assert.equal(header, 'attachment; filename="bad-name-here-2026-08-28.csv"');
  });

  test("an empty name falls back rather than producing a nameless file", () => {
    assert.equal(
      attachmentHeader("!!!", new Date("2026-08-28T00:00:00.000Z")),
      'attachment; filename="export-2026-08-28.csv"',
    );
  });
});
