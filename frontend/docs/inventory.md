# Inventory Page Analysis

## Overview
The Inventory page (`/src/app/inventory/page.tsx`) offers a comprehensive view of the current stock levels, inventory health, and replenishment needs across the entire network. Users can monitor KPIs, analyze health categories, and dive deep into SKU-level inventory details.

## Components Used
- `InventoryKpiCards`
- `InventoryHealth`
- `InventoryNetwork`
- `InventoryFilters`
- `InventoryTable`

## Required Backend APIs with Response Structures

To fully power the Inventory page, the following backend endpoints are required. Each API must return data conforming to the expected JSON structures below.

### 1. KPI & Summary Metrics
- **`GET /api/inventory/kpi`**
  - **Purpose:** Returns overarching inventory metrics.
  - **Expected Response (`InventoryPageKPIs`):**
    ```json
    {
      "totalInventoryValue": 1245000,
      "totalSkus": 845,
      "inStockRate": 96.5,
      "atRiskSkus": 12,
      "atRiskCritical": 4,
      "excessInventoryValue": 45000
    }
    ```
- **`GET /api/inventory/health`**
  - **Purpose:** Returns the distribution of inventory health statuses.
  - **Expected Response (`InventoryHealthBreakdown`):**
    ```json
    {
      "healthy": 612,
      "belowReorderPoint": 98,
      "criticalStock": 42,
      "excessStock": 58,
      "expiringSoon": 35,
      "total": 845
    }
    ```
- **`GET /api/inventory/network`**
  - **Purpose:** Provides a breakdown of inventory levels and value by location or warehouse within the network.
  - **Expected Response (`DistributionCenterStats[]`):**
    ```json
    [
      {
        "id": "DC-01",
        "name": "Northeast DC",
        "capacity": 500000,
        "utilization": 88.5,
        "inventoryValue": 450000,
        "atRiskInventory": 12500,
        "stockoutRisk": 4.2
      }
    ]
    ```

### 2. Inventory Data Table & Details
- **`GET /api/inventory/items`**
  - **Purpose:** Fetches a paginated list of inventory items.
  - **Query Parameters:** `search`, `category`, `location`, `status`, `risk`, `sortBy`, `limit`, `offset`.
  - **Expected Response (`InventoryTableItem[]`):**
    ```json
    [
      {
        "id": "SKU-LIS-10",
        "name": "Lisinopril 10mg Tablets",
        "category": "Cardiovascular",
        "location": "Northeast DC",
        "onHand": 800,
        "safetyStock": 2000,
        "reorderPoint": 2400,
        "daysOfSupply": 4,
        "unitValue": 0.22,
        "inventoryValue": 176,
        "risk": "critical",
        "status": "at_risk"
      }
    ]
    ```
- **`GET /api/inventory/items/{id}`**
  - **Purpose:** Fetches comprehensive details for a specific SKU.
  - **Expected Response (`SkuDetailData`):**
    ```json
    {
      "id": "SKU-LIS-10",
      "name": "Lisinopril 10mg Tablets",
      "manufacturer": "Pfizer / Greenstone LLC",
      "maximumStock": 10000,
      "avgDailyDemand": 165,
      "leadTimeDays": 14,
      "stockoutRiskLevel": "critical",
      "stockoutRiskReason": "Projected stockout in 4 days...",
      "expiryRiskLevel": "none",
      "excessRiskLevel": "none",
      "aiRecommendation": {
        "action": "Expedite Replenishment (Air Freight)",
        "confidence": 94,
        "expectedImpact": "Prevents estimated $45,000 in stockout penalties...",
        "reasoning": "Current stock is 60% below the safety stock threshold...",
        "suggestedQuantity": 5000
      },
      "batches": [
        {
          "id": "B-2024-LIS-01",
          "quantity": 500,
          "expiryDate": "2025-11-30T00:00:00Z"
        }
      ],
      "movements": [
        {
          "id": "MOV-1001",
          "movementType": "Consumption",
          "quantity": -180,
          "date": "2024-03-20T10:00:00Z"
        }
      ]
    }
    ```
