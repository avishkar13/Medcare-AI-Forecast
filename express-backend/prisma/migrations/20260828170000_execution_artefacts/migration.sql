-- Two additions that turn proposals into things somebody can act on.
--
-- DRPPlan.status mirrors SupplyPlan.status. It takes the same PROPOSED default, which
-- backfills every existing row to the state the executor would have written anyway, so
-- no data migration is needed and an in-flight run stays consistent.
--
-- RestockRequest.recommendationId is NULLABLE with a UNIQUE index rather than a plain
-- column: executing a recommendation raises exactly one request, and the constraint is
-- what makes a repeated execute idempotent at the database rather than only in the
-- service. ON DELETE SET NULL because retention prunes old recommendations and a
-- request that outlives its origin is still a real request.

ALTER TABLE "DRPPlan" ADD COLUMN "status" "PlanStatus" NOT NULL DEFAULT 'PROPOSED';

ALTER TABLE "RestockRequest" ADD COLUMN "recommendationId" TEXT;

CREATE UNIQUE INDEX "RestockRequest_recommendationId_key" ON "RestockRequest"("recommendationId");

ALTER TABLE "RestockRequest"
  ADD CONSTRAINT "RestockRequest_recommendationId_fkey"
  FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
