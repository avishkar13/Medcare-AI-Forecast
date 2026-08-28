-- A per item-location minimum stock level, in units.
--
-- E1 asks for "configurable minimum-stock thresholds". The existing override is a
-- stockout *probability*, which is the better planning signal but does not answer
-- "tell me when SKU-1041 at DEL drops below 500 units". This is that number.
--
-- NULLABLE with no backfill and no default, like the two alert overrides beside it:
-- null means the probability rule alone decides, not "zero units", which would arm
-- an alert on every position at once. Nullable-with-no-backfill is also what makes
-- this safe to deploy ahead of the application.

ALTER TABLE "PlanningParameter" ADD COLUMN "minimumStockUnits" DOUBLE PRECISION;
