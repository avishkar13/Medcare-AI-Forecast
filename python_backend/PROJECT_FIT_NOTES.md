# Why this version is fitted to MedCare-AI-Forecast

This package was adapted to the uploaded MedCare project.

## Database mapping

The ML service reads the project's existing PostgreSQL/Prisma schema:

- `Product.sku` / `Product.id` → ML SKU identifier
- `Warehouse.code` / `Warehouse.id` → ML warehouse identifier
- `DemandHistory.date` → time index
- `DemandHistory.orderedQuantity` → demand target
- `DemandHistory.promotionFlag` → promotion feature
- `DemandHistory.holidayFlag` → retained in source adapter for future extension
- `PromotionEvent` → explicit future promotion signal
- Historical demand → learned SKU/DC seasonality index

## Forecast database mapping

The project's Prisma `Forecast` model requires:

- `planningRunId`
- `productId`
- `warehouseId`
- `forecastDate`
- `p10`
- `p50`
- `p90`
- `modelVersion`

The ML service returns everything needed to populate the forecast fields except `planningRunId`. The main backend owns the planning run and database write.

## Important design decision

The ML service is **read-only** against PostgreSQL. It does not write `Forecast`, `InventoryPlan`, `SupplyPlan`, `DRPPlan`, or `Recommendation` records. This keeps the ML boundary separate from planning and optimization.

## Before first use

The previous standalone demo model artifact was intentionally removed from this package. You must train the model against the actual MedCare database:

```powershell
& ".\.venv\Scripts\python.exe" -m src.train_project
```

This prevents a model trained on the old synthetic/demo dataset from being presented as a model trained on the actual project data.
