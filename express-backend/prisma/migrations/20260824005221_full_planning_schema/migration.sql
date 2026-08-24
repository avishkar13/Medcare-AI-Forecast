/*
  Warnings:

  - Added the required column `updatedAt` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PLANNER', 'VIEWER');

-- CreateEnum
CREATE TYPE "WarehouseTier" AS ENUM ('METRO', 'TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PROMOTION', 'SEASONAL', 'HOLIDAY', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupplySource" AS ENUM ('EXISTING', 'TRANSFER', 'PLANNED_SUPPLY');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('INCREASE_SUPPLY', 'REDUCE_SUPPLY', 'TRANSFER_STOCK', 'STOCKOUT_RISK', 'EXPIRY_RISK');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED', 'COMPLETED');

-- AlterEnum
ALTER TYPE "Criticality" ADD VALUE 'CRITICAL';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "criticality" "Criticality" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLANNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "tier" "WarehouseTier" NOT NULL,
    "location" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "orderedQuantity" DOUBLE PRECISION NOT NULL,
    "fulfilledQuantity" DOUBLE PRECISION,
    "stockoutFlag" BOOLEAN NOT NULL DEFAULT false,
    "promotionFlag" BOOLEAN NOT NULL DEFAULT false,
    "holidayFlag" BOOLEAN NOT NULL DEFAULT false,
    "season" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "onHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reserved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inTransit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningParameter" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "leadTimeStdDev" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serviceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "reviewPeriodDays" INTEGER NOT NULL DEFAULT 7,
    "minimumOrderQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maximumInventory" DOUBLE PRECISION,
    "holdingCostPerUnit" DOUBLE PRECISION NOT NULL,
    "stockoutCostPerUnit" DOUBLE PRECISION NOT NULL,
    "expiryCostPerUnit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PlanningParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionEvent" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "warehouseId" TEXT,
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL DEFAULT 'PROMOTION',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "upliftFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandSignal" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "region" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "signalType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "warehouseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorOrder" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "fulfilledQuantity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "demandMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "leadTimeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "capacityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "serviceLevelTarget" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningRun" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "horizonDays" INTEGER NOT NULL,
    "modelVersion" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL,
    "planningRunId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "p10" DOUBLE PRECISION NOT NULL,
    "p50" DOUBLE PRECISION NOT NULL,
    "p90" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPlan" (
    "id" TEXT NOT NULL,
    "planningRunId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "forecastDemand" DOUBLE PRECISION NOT NULL,
    "safetyStock" DOUBLE PRECISION NOT NULL,
    "reorderPoint" DOUBLE PRECISION NOT NULL,
    "openingInventory" DOUBLE PRECISION NOT NULL,
    "projectedInventory" DOUBLE PRECISION NOT NULL,
    "netRequirement" DOUBLE PRECISION NOT NULL,
    "daysOfSupply" DOUBLE PRECISION,
    "stockoutRisk" DOUBLE PRECISION,
    "expiryRisk" DOUBLE PRECISION,

    CONSTRAINT "InventoryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyPlan" (
    "id" TEXT NOT NULL,
    "planningRunId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "source" "SupplySource" NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'PROPOSED',

    CONSTRAINT "SupplyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DRPPlan" (
    "id" TEXT NOT NULL,
    "planningRunId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,

    CONSTRAINT "DRPPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizationResult" (
    "id" TEXT NOT NULL,
    "planningRunId" TEXT NOT NULL,
    "objectiveValue" DOUBLE PRECISION NOT NULL,
    "holdingCost" DOUBLE PRECISION NOT NULL,
    "stockoutCost" DOUBLE PRECISION NOT NULL,
    "transferCost" DOUBLE PRECISION NOT NULL,
    "expiryCost" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "solver" TEXT NOT NULL,
    "solverStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptimizationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "planningRunId" TEXT NOT NULL,
    "iterations" INTEGER NOT NULL,
    "serviceLevel" DOUBLE PRECISION NOT NULL,
    "stockoutProbability" DOUBLE PRECISION NOT NULL,
    "expiryProbability" DOUBLE PRECISION NOT NULL,
    "expectedInventory" DOUBLE PRECISION NOT NULL,
    "expectedWaste" DOUBLE PRECISION NOT NULL,
    "expectedCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "planningRunId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "priority" "Priority" NOT NULL,
    "message" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "actedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_tier_idx" ON "Warehouse"("tier");

-- CreateIndex
CREATE INDEX "DemandHistory_productId_warehouseId_date_idx" ON "DemandHistory"("productId", "warehouseId", "date");

-- CreateIndex
CREATE INDEX "DemandHistory_date_idx" ON "DemandHistory"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DemandHistory_productId_warehouseId_date_key" ON "DemandHistory"("productId", "warehouseId", "date");

-- CreateIndex
CREATE INDEX "Inventory_warehouseId_idx" ON "Inventory"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_warehouseId_key" ON "Inventory"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "InventoryBatch_productId_warehouseId_expiryDate_idx" ON "InventoryBatch"("productId", "warehouseId", "expiryDate");

-- CreateIndex
CREATE INDEX "InventoryBatch_expiryDate_idx" ON "InventoryBatch"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningParameter_productId_warehouseId_key" ON "PlanningParameter"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "PromotionEvent_startDate_endDate_idx" ON "PromotionEvent"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "PromotionEvent_productId_startDate_idx" ON "PromotionEvent"("productId", "startDate");

-- CreateIndex
CREATE INDEX "DemandSignal_signalType_date_idx" ON "DemandSignal"("signalType", "date");

-- CreateIndex
CREATE INDEX "DemandSignal_productId_date_idx" ON "DemandSignal"("productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_code_key" ON "Distributor"("code");

-- CreateIndex
CREATE INDEX "DistributorOrder_productId_warehouseId_orderDate_idx" ON "DistributorOrder"("productId", "warehouseId", "orderDate");

-- CreateIndex
CREATE INDEX "DistributorOrder_distributorId_orderDate_idx" ON "DistributorOrder"("distributorId", "orderDate");

-- CreateIndex
CREATE INDEX "PlanningRun_createdAt_idx" ON "PlanningRun"("createdAt");

-- CreateIndex
CREATE INDEX "PlanningRun_status_completedAt_idx" ON "PlanningRun"("status", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Forecast_planningRunId_productId_warehouseId_forecastDate_key" ON "Forecast"("planningRunId", "productId", "warehouseId", "forecastDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPlan_planningRunId_productId_warehouseId_date_key" ON "InventoryPlan"("planningRunId", "productId", "warehouseId", "date");

-- CreateIndex
CREATE INDEX "SupplyPlan_planningRunId_productId_warehouseId_idx" ON "SupplyPlan"("planningRunId", "productId", "warehouseId");

-- CreateIndex
CREATE INDEX "DRPPlan_planningRunId_productId_idx" ON "DRPPlan"("planningRunId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "OptimizationResult_planningRunId_key" ON "OptimizationResult"("planningRunId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationRun_planningRunId_key" ON "SimulationRun"("planningRunId");

-- CreateIndex
CREATE INDEX "Recommendation_status_priority_idx" ON "Recommendation"("status", "priority");

-- CreateIndex
CREATE INDEX "Recommendation_planningRunId_status_idx" ON "Recommendation"("planningRunId", "status");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_criticality_idx" ON "Product"("criticality");

-- AddForeignKey
ALTER TABLE "DemandHistory" ADD CONSTRAINT "DemandHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandHistory" ADD CONSTRAINT "DemandHistory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningParameter" ADD CONSTRAINT "PlanningParameter_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningParameter" ADD CONSTRAINT "PlanningParameter_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionEvent" ADD CONSTRAINT "PromotionEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionEvent" ADD CONSTRAINT "PromotionEvent_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandSignal" ADD CONSTRAINT "DemandSignal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorOrder" ADD CONSTRAINT "DistributorOrder_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorOrder" ADD CONSTRAINT "DistributorOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorOrder" ADD CONSTRAINT "DistributorOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningRun" ADD CONSTRAINT "PlanningRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningRun" ADD CONSTRAINT "PlanningRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_planningRunId_fkey" FOREIGN KEY ("planningRunId") REFERENCES "PlanningRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPlan" ADD CONSTRAINT "InventoryPlan_planningRunId_fkey" FOREIGN KEY ("planningRunId") REFERENCES "PlanningRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPlan" ADD CONSTRAINT "InventoryPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPlan" ADD CONSTRAINT "InventoryPlan_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyPlan" ADD CONSTRAINT "SupplyPlan_planningRunId_fkey" FOREIGN KEY ("planningRunId") REFERENCES "PlanningRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyPlan" ADD CONSTRAINT "SupplyPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyPlan" ADD CONSTRAINT "SupplyPlan_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRPPlan" ADD CONSTRAINT "DRPPlan_planningRunId_fkey" FOREIGN KEY ("planningRunId") REFERENCES "PlanningRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRPPlan" ADD CONSTRAINT "DRPPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRPPlan" ADD CONSTRAINT "DRPPlan_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DRPPlan" ADD CONSTRAINT "DRPPlan_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationResult" ADD CONSTRAINT "OptimizationResult_planningRunId_fkey" FOREIGN KEY ("planningRunId") REFERENCES "PlanningRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_planningRunId_fkey" FOREIGN KEY ("planningRunId") REFERENCES "PlanningRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_planningRunId_fkey" FOREIGN KEY ("planningRunId") REFERENCES "PlanningRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
