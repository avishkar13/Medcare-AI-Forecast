-- AlterTable
ALTER TABLE "OptimizationResult" ADD COLUMN     "baselineCost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PlanningRun" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "failureStage" TEXT;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "impactValue" DOUBLE PRECISION;
