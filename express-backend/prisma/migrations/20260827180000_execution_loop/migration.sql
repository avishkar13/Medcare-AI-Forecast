-- Phase 3 - the execution loop.
--
-- StockMovement gains the columns that make it a real ledger. They are NOT NULL, which
-- is only safe because the table is empty: nothing has ever written it (Phase 3.1 is
-- its first writer), verified before this migration was generated. Adding NOT NULL
-- ahead of data is what failed init_rbac; here there is no data to be ahead of.

ALTER TABLE "StockMovement" ADD COLUMN "productId" TEXT NOT NULL;
ALTER TABLE "StockMovement" ADD COLUMN "stockBefore" DOUBLE PRECISION NOT NULL;
ALTER TABLE "StockMovement" ADD COLUMN "stockAfter" DOUBLE PRECISION NOT NULL;
ALTER TABLE "StockMovement" ADD COLUMN "triggeredAlertId" TEXT;
ALTER TABLE "StockMovement" ALTER COLUMN "warehouseId" SET NOT NULL;

CREATE INDEX "StockMovement_productId_warehouseId_date_idx" ON "StockMovement"("productId", "warehouseId", "date");
CREATE INDEX "StockMovement_triggeredAlertId_idx" ON "StockMovement"("triggeredAlertId");

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SET NULL, not CASCADE: deleting an alert must not delete the movement that raised it.
-- The ledger is the record of what happened; the alert is a derived view over it.
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_triggeredAlertId_fkey"
  FOREIGN KEY ("triggeredAlertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 3.3 - when a DC last reported in. Nullable: null means it never has.
ALTER TABLE "Warehouse" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

-- Phase 3.5 - a human asking for stock, as opposed to a SupplyPlan the executor proposes.
CREATE TYPE "RestockStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'FULFILLED');

CREATE TABLE "RestockRequest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "status" "RestockStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "notes" TEXT,
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "fulfillmentMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestockRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RestockRequest_warehouseId_status_idx" ON "RestockRequest"("warehouseId", "status");
CREATE INDEX "RestockRequest_productId_warehouseId_idx" ON "RestockRequest"("productId", "warehouseId");

ALTER TABLE "RestockRequest" ADD CONSTRAINT "RestockRequest_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestockRequest" ADD CONSTRAINT "RestockRequest_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestockRequest" ADD CONSTRAINT "RestockRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestockRequest" ADD CONSTRAINT "RestockRequest_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
