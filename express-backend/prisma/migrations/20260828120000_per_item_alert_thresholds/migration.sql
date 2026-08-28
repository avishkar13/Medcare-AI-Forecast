-- Per item-location alert thresholds.
--
-- Both columns are NULLABLE with no backfill and no default. Null means "inherit the
-- global value in AlertSettings" - it is an override, not a default. Giving them a
-- default would flatten every pair onto one number, which is the defect being fixed.
--
-- Nullable-with-no-backfill is also what makes this safe on the shared database: there
-- is no existing data to be ahead of, which is how init_rbac failed.

ALTER TABLE "PlanningParameter" ADD COLUMN "alertStockoutProbability" DOUBLE PRECISION;
ALTER TABLE "PlanningParameter" ADD COLUMN "alertExpiryWindowDays" INTEGER;
