-- Phase 2.2 / 2.3 - warehouse foreign keys on the two orphan models.
--
-- Both columns are NULLABLE and there is no backfill. StockMovement has no rows
-- (nothing writes it yet - Phase 3.1 is its writer) and WastePreventionRecord
-- carries no warehouse to recover one from. Adding either as NOT NULL ahead of its
-- data is what failed 20260826191321_init_rbac on the shared database and blocked
-- every migration behind it with P3009.

ALTER TABLE "StockMovement" ADD COLUMN "warehouseId" TEXT;
ALTER TABLE "WastePreventionRecord" ADD COLUMN "warehouseId" TEXT;

CREATE INDEX "StockMovement_warehouseId_date_idx" ON "StockMovement"("warehouseId", "date");
CREATE INDEX "WastePreventionRecord_warehouseId_idx" ON "WastePreventionRecord"("warehouseId");

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WastePreventionRecord"
  ADD CONSTRAINT "WastePreventionRecord_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
