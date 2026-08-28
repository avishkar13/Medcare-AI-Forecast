import { csvFile } from "../utils/csv.js";
import { listAlerts } from "./alert.service.js";
import { listInventory } from "./inventory.service.js";
import { listRecommendations } from "./recommendation.service.js";
import type { AlertQuery } from "../zod/alert.schemas.js";
import type { InventoryQuery } from "../zod/inventory.schemas.js";
import type { RecommendationQuery } from "../zod/recommendation.schemas.js";

/**
 * The three files E1 asks for as output: a low-stock alert log, an item-wise stock
 * view, and a reorder action summary.
 *
 * **Each one reuses the service behind its own list route** rather than issuing its own
 * query. That is the whole design: an export that built its own `where` clause would
 * drift from the screen it claims to be a copy of, and "the CSV disagrees with the
 * dashboard" is a worse bug than having no CSV. The filters a caller passes are the
 * same filters, parsed by the same schema, applied by the same code.
 *
 * Held in memory rather than streamed, unlike `/api/training-data`. That route streams
 * because it exports the whole demand history - tens of thousands of rows. These three
 * are bounded by what a planner is looking at: 160 positions, and alert and
 * recommendation tables that the executor itself caps. Streaming would buy nothing and
 * cost the one thing that matters here - a failure mid-stream cannot be reported,
 * because the 200 and the headers have already gone out. Building the file first means
 * an error is still an error envelope.
 */

/** A ceiling, so a future table that grows past what this design assumes fails loudly. */
const MAX_ROWS = 20_000;

export class ExportTooLargeError extends Error {
  constructor(rows: number) {
    super(`Export would be ${rows} rows, above the ${MAX_ROWS}-row limit for a CSV export`);
    this.name = "ExportTooLargeError";
  }
}

const assertWithinLimit = (total: number) => {
  if (total > MAX_ROWS) throw new ExportTooLargeError(total);
};

export interface CsvExport {
  filename: string;
  rows: number;
  body: string;
}

type Scope = { warehouseId?: string | null } | undefined;

/**
 * E1 output 1 - the low-stock alert log.
 *
 * Every open condition the detector has raised, with the business impact and the
 * action it recommends, so the file answers "what needs doing" and not merely "what
 * happened".
 */
export const exportAlerts = async (query: AlertQuery, scope?: Scope): Promise<CsvExport> => {
  const { items, total } = await listAlerts({ ...query, page: 1, pageSize: MAX_ROWS }, scope);
  assertWithinLimit(total);

  return {
    filename: "low-stock-alert-log",
    rows: items.length,
    body: csvFile(
      [
        "Detected at",
        "Age (days)",
        "Severity",
        "Type",
        "Status",
        "SKU",
        "Product",
        "Location",
        "Title",
        "Business impact",
        "Recommended action",
      ],
      items.map((alert) => [
        alert.detectedAt,
        alert.ageDays,
        alert.severity,
        alert.type,
        alert.status,
        alert.sku,
        alert.product,
        alert.location,
        alert.title,
        alert.businessImpact,
        alert.recommendedAction,
      ]),
    ),
  };
};

/**
 * E1 output 2 - the item-wise stock view.
 *
 * Carries the three counts the rest of the system distinguishes between - on hand,
 * available and inventory position - because a reader comparing a single "stock"
 * column against a reorder point would reach a different verdict from the detector.
 */
export const exportInventory = async (
  query: InventoryQuery,
  scope?: Scope,
): Promise<CsvExport> => {
  const { report, total } = await listInventory({ ...query, page: 1, pageSize: MAX_ROWS }, scope);
  assertWithinLimit(total);

  return {
    filename: "item-wise-stock-view",
    rows: report.items.length,
    body: csvFile(
      [
        "SKU",
        "Product",
        "Category",
        "Criticality",
        "DC",
        "DC name",
        "On hand",
        "Reserved",
        "In transit",
        "Available",
        "Inventory position",
        "Safety stock",
        "Reorder point",
        "Days of supply",
        "Lead time (days)",
        "Status",
        "Risk",
        "Unit cost",
        "Inventory value",
      ],
      report.items.map((item) => [
        item.sku,
        item.productName,
        item.category,
        item.criticality,
        item.warehouseCode,
        item.warehouseName,
        item.onHand,
        item.reserved,
        item.inTransit,
        item.available,
        item.inventoryPosition,
        item.safetyStock,
        item.reorderPoint,
        item.daysOfSupply,
        item.leadTimeDays,
        item.status,
        item.risk,
        item.unitCost,
        item.inventoryValue,
      ]),
    ),
  };
};

/**
 * E1 output 3 - the reorder action summary.
 *
 * The planner's recommendations with the money attached, ordered as the review surface
 * orders them, so the file is a work list rather than a dump.
 */
export const exportRecommendations = async (
  query: RecommendationQuery,
  scope?: Scope,
): Promise<CsvExport> => {
  const { items, total } = await listRecommendations(
    { ...query, page: 1, pageSize: MAX_ROWS },
    scope,
  );
  assertWithinLimit(total);

  return {
    filename: "reorder-action-summary",
    rows: items.length,
    body: csvFile(
      [
        "Created at",
        "Priority",
        "Type",
        "Status",
        "SKU",
        "Product",
        "DC",
        "Quantity",
        "Impact value",
        "Confidence",
        "Recommendation",
        "Restock request raised",
      ],
      items.map((item) => [
        item.createdAt,
        item.priority,
        item.type,
        item.status,
        item.sku,
        item.productName,
        item.warehouseCode,
        item.quantity,
        item.impactValue,
        item.confidence,
        item.message,
        // Executing a recommendation raises one of these, so the file shows whether
        // the action was actually taken rather than only that it was proposed.
        item.restockRequest === null ? "" : item.restockRequest.status,
      ]),
    ),
  };
};
