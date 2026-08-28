/**
 * CSV serialisation for the export routes.
 *
 * Pure and separate from the services that feed it, so the escaping rules are testable
 * without a database - the same split `utils/supply.ts` and `utils/movement.ts` use.
 */

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than as text.
 *
 * This matters here specifically: these files carry free-text `reason` and `notes`
 * fields that a user typed. A cell beginning `=` is executed on open in Excel and
 * Sheets, which is how a CSV export becomes an injection vector.
 */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

const needsQuoting = (value: string) =>
  value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r");

/**
 * One cell, escaped per RFC 4180.
 *
 * Null and undefined render as empty rather than as the strings "null"/"undefined" - a
 * blank cell is what a reader expects for a value that was never set, and it is what
 * re-importing the file will read back as absent.
 */
export const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";

  const raw =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "number"
        ? Number.isFinite(value)
          ? String(value)
          : ""
        : String(value);

  // Prefixed with an apostrophe, not stripped: the text stays readable and stays
  // faithful to what was stored, while the spreadsheet reads it as a literal. A
  // negative number is exempt - "-5" is a number, not a formula.
  const guarded =
    FORMULA_PREFIXES.some((prefix) => raw.startsWith(prefix)) && !/^-?\d/.test(raw)
      ? `'${raw}`
      : raw;

  return needsQuoting(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
};

export const csvRow = (cells: readonly unknown[]): string => cells.map(csvCell).join(",");

/**
 * A whole file, header first.
 *
 * CRLF because RFC 4180 specifies it and because Excel on Windows - which is what a
 * planner opens these in - renders a lone LF as one unbroken line.
 */
export const csvFile = (
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string => [csvRow(header), ...rows.map(csvRow)].join("\r\n") + "\r\n";

/**
 * A `Content-Disposition` value carrying a dated filename.
 *
 * The name is sanitised rather than trusted: it ends up in a header, and a quote or a
 * newline in it would let a caller-supplied string break the response.
 */
export const attachmentHeader = (basename: string, date = new Date()): string => {
  const stripped = basename.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60);
  // Tested against the empty *result*, not the empty input: "!!!" strips to "---",
  // which is truthy and would otherwise sail past a plain `|| "export"` and name the
  // file "---". A name has to keep at least one real character to count as a name.
  const safe = /[a-zA-Z0-9]/.test(stripped) ? stripped : "export";
  return `attachment; filename="${safe}-${date.toISOString().slice(0, 10)}.csv"`;
};
