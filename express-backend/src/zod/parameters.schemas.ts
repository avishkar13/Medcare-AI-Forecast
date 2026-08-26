import { z } from "zod";

const text = z.string().trim().min(1);
const nonNegative = z.number().finite().min(0);

export const parametersQuerySchema = z.object({
  /** Product cuid or `sku`. */
  sku: text.optional(),
  /** Warehouse cuid or `code`. */
  warehouse: text.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * The values the executor plans with.
 *
 * Bounds match the rest of the system rather than being invented here:
 * `serviceLevel` uses the same 0.5-0.999 band as `Scenario.serviceLevelTarget`,
 * because both end up in the same z-score.
 */
export const upsertParametersBodySchema = z
  .strictObject({
    sku: text,
    warehouse: text,
    leadTimeDays: z.number().int().min(0).max(365),
    leadTimeStdDev: nonNegative.max(365).default(0),
    serviceLevel: z.number().min(0.5).max(0.999).default(0.95),
    /** The review cadence - outcome 5 of the brief, in its most literal form. */
    reviewPeriodDays: z.number().int().min(1).max(365).default(7),
    minimumOrderQty: nonNegative.default(0),
    maximumInventory: nonNegative.nullable().default(null),
    holdingCostPerUnit: nonNegative,
    stockoutCostPerUnit: nonNegative,
    expiryCostPerUnit: nonNegative,
  })
  .refine(
    (value) =>
      value.maximumInventory === null || value.maximumInventory >= value.minimumOrderQty,
    {
      // A ceiling below the floor makes every order-up-to level unsatisfiable, and
      // the executor would clamp to a maximum it can never legally reach.
      message: "maximumInventory must not be below minimumOrderQty",
      path: ["maximumInventory"],
    },
  );

export type ParametersQuery = z.infer<typeof parametersQuerySchema>;
export type UpsertParametersBody = z.infer<typeof upsertParametersBodySchema>;
