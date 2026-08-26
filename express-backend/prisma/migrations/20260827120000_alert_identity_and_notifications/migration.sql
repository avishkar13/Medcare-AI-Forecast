-- Alert identity moves from the warehouse display name onto ids, and notification
-- delivery gets a table of its own.
--
-- The `product` column is RENAMED rather than dropped and re-added: it holds the
-- display copy a detector wrote and there is no reason to lose it. Prisma's own
-- diff would have generated a drop/add pair here, which is why this file is written
-- by hand.

-- AlterTable
ALTER TABLE "Alert" RENAME COLUMN "product" TO "productName";

ALTER TABLE "Alert" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "warehouseId" TEXT,
ADD COLUMN     "notifiedAt" TIMESTAMP(3);

-- Backfill from the display names before anything keys on the ids. Without this
-- every already-acknowledged alert would fail to match its own condition on the next
-- detection cycle, be retired as "no longer detected", and re-raise as new.
UPDATE "Alert" a
SET "warehouseId" = w."id"
FROM "Warehouse" w
WHERE a."location" = w."name" AND a."warehouseId" IS NULL;

UPDATE "Alert" a
SET "productId" = p."id"
FROM "Product" p
WHERE a."sku" = p."sku" AND a."productId" IS NULL;

-- CreateIndex
CREATE INDEX "Alert_warehouseId_idx" ON "Alert"("warehouseId");
CREATE INDEX "Alert_productId_idx" ON "Alert"("productId");
CREATE INDEX "Alert_status_severity_idx" ON "Alert"("status", "severity");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recipient" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationDelivery_alertId_idx" ON "NotificationDelivery"("alertId");
CREATE INDEX "NotificationDelivery_channel_status_idx" ON "NotificationDelivery"("channel", "status");
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
