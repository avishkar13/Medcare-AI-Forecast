-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "actionType" TEXT,
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "expectedImpact" TEXT;

-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN     "riskLevel" TEXT;

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "product" TEXT,
    "location" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "businessImpact" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "movementType" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "reference" TEXT,
    "userOrSystem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WastePreventionRecord" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "unitsSaved" DOUBLE PRECISION NOT NULL,
    "valueSaved" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WastePreventionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertMetric" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AlertMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertTimelineEvent" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "AlertTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationSignal" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "direction" TEXT NOT NULL,

    CONSTRAINT "RecommendationSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationMetric" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "simulatedValue" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "format" TEXT NOT NULL,

    CONSTRAINT "SimulationMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioDCImpact" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentCapacity" DOUBLE PRECISION NOT NULL,
    "simulatedCapacity" DOUBLE PRECISION NOT NULL,
    "currentStockoutRisk" DOUBLE PRECISION NOT NULL,
    "simulatedStockoutRisk" DOUBLE PRECISION NOT NULL,
    "currentAtRiskValue" DOUBLE PRECISION NOT NULL,
    "simulatedAtRiskValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ScenarioDCImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioSKUImpact" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "currentInventory" DOUBLE PRECISION NOT NULL,
    "simulatedInventory" DOUBLE PRECISION NOT NULL,
    "optimalInventory" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ScenarioSKUImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioRiskIndicator" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "simulatedValue" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,

    CONSTRAINT "ScenarioRiskIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralSettings" (
    "id" TEXT NOT NULL,
    "systemSettingsId" TEXT NOT NULL,
    "workspaceName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "dateFormat" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "density" TEXT NOT NULL,
    "defaultLandingPage" TEXT NOT NULL,

    CONSTRAINT "GeneralSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastSettings" (
    "id" TEXT NOT NULL,
    "systemSettingsId" TEXT NOT NULL,
    "defaultHorizon" INTEGER NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL,
    "updateFrequency" TEXT NOT NULL,
    "predictionInterval" DOUBLE PRECISION NOT NULL,
    "autoRefresh" BOOLEAN NOT NULL,
    "targetAccuracy" DOUBLE PRECISION NOT NULL,
    "alertAccuracyThreshold" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ForecastSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySettings" (
    "id" TEXT NOT NULL,
    "systemSettingsId" TEXT NOT NULL,
    "defaultSafetyStock" DOUBLE PRECISION NOT NULL,
    "reorderPoint" DOUBLE PRECISION NOT NULL,
    "maxInventory" DOUBLE PRECISION NOT NULL,
    "minServiceLevel" DOUBLE PRECISION NOT NULL,
    "autoReorder" BOOLEAN NOT NULL,
    "coverageWarning" DOUBLE PRECISION NOT NULL,
    "coverageCritical" DOUBLE PRECISION NOT NULL,
    "safetyStockWarning" DOUBLE PRECISION NOT NULL,
    "safetyStockCritical" DOUBLE PRECISION NOT NULL,
    "capacityWarning" DOUBLE PRECISION NOT NULL,
    "capacityCritical" DOUBLE PRECISION NOT NULL,
    "expiryWindowWarning" DOUBLE PRECISION NOT NULL,
    "expiryWindowCritical" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "InventorySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSettings" (
    "id" TEXT NOT NULL,
    "systemSettingsId" TEXT NOT NULL,
    "realTimeMonitoring" BOOLEAN NOT NULL,
    "typeStockoutRisk" BOOLEAN NOT NULL,
    "typeDemandSpike" BOOLEAN NOT NULL,
    "typeExpiryRisk" BOOLEAN NOT NULL,
    "typeSupplierDelay" BOOLEAN NOT NULL,
    "typeCapacityBreach" BOOLEAN NOT NULL,
    "typeForecastAnomaly" BOOLEAN NOT NULL,
    "typeOverstock" BOOLEAN NOT NULL,
    "thresholdStockoutProb" DOUBLE PRECISION NOT NULL,
    "thresholdDemandDeviation" DOUBLE PRECISION NOT NULL,
    "thresholdExpiryWindow" DOUBLE PRECISION NOT NULL,
    "thresholdCapacityUtil" DOUBLE PRECISION NOT NULL,
    "thresholdSupplierDelay" DOUBLE PRECISION NOT NULL,
    "escalationCritical" TEXT NOT NULL,
    "escalationHigh" TEXT NOT NULL,
    "escalationMedium" TEXT NOT NULL,
    "escalationLow" TEXT NOT NULL,

    CONSTRAINT "AlertSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "systemSettingsId" TEXT NOT NULL,
    "channelInApp" BOOLEAN NOT NULL,
    "channelEmail" BOOLEAN NOT NULL,
    "channelSms" BOOLEAN NOT NULL,
    "channelTeams" BOOLEAN NOT NULL,
    "dailyDigestEnabled" BOOLEAN NOT NULL,
    "dailyDigestTime" TEXT NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "notificationSettingsId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL,
    "email" BOOLEAN NOT NULL,
    "sms" BOOLEAN NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISettings" (
    "id" TEXT NOT NULL,
    "systemSettingsId" TEXT NOT NULL,
    "primaryModel" TEXT NOT NULL,
    "modelConfidence" DOUBLE PRECISION NOT NULL,
    "recommendationConfidence" DOUBLE PRECISION NOT NULL,
    "featRecommendations" BOOLEAN NOT NULL,
    "featExplainability" BOOLEAN NOT NULL,
    "featAutoRiskDetection" BOOLEAN NOT NULL,
    "factorDemandForecast" DOUBLE PRECISION NOT NULL,
    "factorInventoryPosition" DOUBLE PRECISION NOT NULL,
    "factorLeadTime" DOUBLE PRECISION NOT NULL,
    "factorExpiryRisk" DOUBLE PRECISION NOT NULL,
    "factorNetworkCapacity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AISettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSettings" (
    "id" TEXT NOT NULL,
    "systemSettingsId" TEXT NOT NULL,
    "autoSync" BOOLEAN NOT NULL,
    "syncFrequency" TEXT NOT NULL,
    "apiStatus" TEXT NOT NULL,
    "apiEnvironment" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,

    CONSTRAINT "IntegrationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSource" (
    "id" TEXT NOT NULL,
    "integrationSettingsId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSync" TEXT NOT NULL,
    "records" INTEGER NOT NULL,

    CONSTRAINT "IntegrationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecuritySettings" (
    "id" TEXT NOT NULL,
    "systemSettingsId" TEXT NOT NULL,
    "twoFactor" BOOLEAN NOT NULL,
    "sessionTimeout" INTEGER NOT NULL,
    "passwordPolicy" TEXT NOT NULL,
    "loginAlerts" BOOLEAN NOT NULL,
    "auditLogging" BOOLEAN NOT NULL,

    CONSTRAINT "SecuritySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneralSettings_systemSettingsId_key" ON "GeneralSettings"("systemSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastSettings_systemSettingsId_key" ON "ForecastSettings"("systemSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySettings_systemSettingsId_key" ON "InventorySettings"("systemSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertSettings_systemSettingsId_key" ON "AlertSettings"("systemSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_systemSettingsId_key" ON "NotificationSettings"("systemSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "AISettings_systemSettingsId_key" ON "AISettings"("systemSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSettings_systemSettingsId_key" ON "IntegrationSettings"("systemSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "SecuritySettings_systemSettingsId_key" ON "SecuritySettings"("systemSettingsId");

-- AddForeignKey
ALTER TABLE "AlertMetric" ADD CONSTRAINT "AlertMetric_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertTimelineEvent" ADD CONSTRAINT "AlertTimelineEvent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationSignal" ADD CONSTRAINT "RecommendationSignal_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationMetric" ADD CONSTRAINT "SimulationMetric_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioDCImpact" ADD CONSTRAINT "ScenarioDCImpact_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioSKUImpact" ADD CONSTRAINT "ScenarioSKUImpact_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioRiskIndicator" ADD CONSTRAINT "ScenarioRiskIndicator_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralSettings" ADD CONSTRAINT "GeneralSettings_systemSettingsId_fkey" FOREIGN KEY ("systemSettingsId") REFERENCES "SystemSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastSettings" ADD CONSTRAINT "ForecastSettings_systemSettingsId_fkey" FOREIGN KEY ("systemSettingsId") REFERENCES "SystemSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySettings" ADD CONSTRAINT "InventorySettings_systemSettingsId_fkey" FOREIGN KEY ("systemSettingsId") REFERENCES "SystemSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSettings" ADD CONSTRAINT "AlertSettings_systemSettingsId_fkey" FOREIGN KEY ("systemSettingsId") REFERENCES "SystemSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_systemSettingsId_fkey" FOREIGN KEY ("systemSettingsId") REFERENCES "SystemSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_notificationSettingsId_fkey" FOREIGN KEY ("notificationSettingsId") REFERENCES "NotificationSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISettings" ADD CONSTRAINT "AISettings_systemSettingsId_fkey" FOREIGN KEY ("systemSettingsId") REFERENCES "SystemSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSettings" ADD CONSTRAINT "IntegrationSettings_systemSettingsId_fkey" FOREIGN KEY ("systemSettingsId") REFERENCES "SystemSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSource" ADD CONSTRAINT "IntegrationSource_integrationSettingsId_fkey" FOREIGN KEY ("integrationSettingsId") REFERENCES "IntegrationSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecuritySettings" ADD CONSTRAINT "SecuritySettings_systemSettingsId_fkey" FOREIGN KEY ("systemSettingsId") REFERENCES "SystemSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
