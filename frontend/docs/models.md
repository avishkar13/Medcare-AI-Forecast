# Models Analysis Report: Frontend vs Backend

## 1. Overview
This report analyzes the alignment between the frontend types (expected by the UI) and the backend Prisma schema. The goal is to identify gaps and propose schema updates to fully support the frontend requirements.

## 2. Current Backend Models (Prisma)
- **Core Entities:** `User`, `Product`, `Warehouse`, `Distributor`, `DistributorOrder`
- **Inventory & Operations:** `Inventory`, `InventoryBatch`, `PlanningParameter`
- **Demand & Planning:** `DemandHistory`, `PromotionEvent`, `DemandSignal`, `PlanningRun`
- **Output / Plans:** `Forecast`, `InventoryPlan`, `SupplyPlan`, `DRPPlan`
- **Advanced:** `Scenario`, `OptimizationResult`, `SimulationRun`, `Recommendation`

## 3. Current Frontend Models (Types)
- **Alerts:** `SystemAlert`, `AlertOverviewData`
- **Expiry:** `ExpiryBatch`, `DistributionCenterExpiry`, `WastePreventionRecord`
- **Forecast:** `ForecastTableItem`, `SeasonalityData`, `ModelPerformanceItem`, `ForecastImpactData`
- **Inventory:** `InventoryTableItem`, `SkuDetailData`, `StockBatch`, `StockMovement`
- **Recommendations:** `RecommendationItem`, `RecommendationImpact`, `RecommendationIntelligence`
- **Settings:** `AppSettings` (General, Forecast, Inventory, Alerts, Notifications, AI, Integrations, Security)
- **Simulation:** `SimulationParams`, `SimulationMetric`, `DCImpact`, `SavedScenario`

## 4. Gap Analysis & Required Sync

### Gap 1: Alerts System
- **Frontend Expects:** Detailed `SystemAlert` objects with `severity`, `type`, `businessImpact`, `metrics` (JSON array), and `timeline` (JSON array).
- **Backend Reality:** There is NO `Alert` model in the backend schema.
- **Proposed Action:** Create an `Alert` model in `schema.prisma`.

### Gap 2: System Settings
- **Frontend Expects:** Comprehensive `AppSettings` controlling AI, Forecast, Inventory thresholds, and Notifications.
- **Backend Reality:** No settings model exists.
- **Proposed Action:** Create a `SystemSettings` or `TenantSettings` model. Since the settings are highly nested, a single model with JSON fields (or a key-value store) is best.

### Gap 3: Stock Movements (Transactions Ledger)
- **Frontend Expects:** `StockMovement` history for SKU detailed views (Consumption, Replenishment, Transfer, Adjustment).
- **Backend Reality:** Has `DemandHistory`, `SupplyPlan`, `DRPPlan`, but lacks a unified transactional ledger for historical tracking.
- **Proposed Action:** Create a `StockMovement` or `InventoryTransaction` model to record all in/out/adjustment events.

### Gap 4: Recommendations Payload
- **Frontend Expects:** `actionType`, `priority`, `confidence`, `reason`, `expectedImpact`, `impactValue`, and `signals` (array).
- **Backend Reality:** `Recommendation` model has `type`, `priority`, `message`, `quantity`, `status`.
- **Proposed Action:** Expand the `Recommendation` model in Prisma to include `confidence` (Float), `expectedImpact` (String), `impactValue` (Float), and `signals` (JSON).

### Gap 5: Expiry & Waste Prevention
- **Frontend Expects:** `WastePreventionRecord` to track value saved from early interventions (FEFO).
- **Backend Reality:** No model tracks waste prevention.
- **Proposed Action:** Create a `WastePreventionRecord` model.

### Gap 6: Simulation Parameters
- **Frontend Expects:** Parameters like `demandShock`, `inventoryAvailability`, `serviceLevelTarget`, `supplierLeadTime`, `distributionCapacity`.
- **Backend Reality:** `Scenario` model has `demandMultiplier`, `leadTimeMultiplier`, `capacityMultiplier`.
- **Proposed Action:** Align `Scenario` fields closely with frontend `SimulationParams`. Add a JSON field to `Scenario` or `SimulationRun` to store the exact UI input/output metrics.

## 5. Conclusion
The backend schema is robust for a supply chain planning engine but lacks the operational models required to power the specific UI/UX designed in the frontend (Alerts, Settings, Ledgers, Waste Records, and specific AI confidence metadata). Updating the Prisma schema to support these missing pieces is required before API development can begin.
