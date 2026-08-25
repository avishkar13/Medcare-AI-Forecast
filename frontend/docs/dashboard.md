# Dashboard Page Analysis

## Overview
The Dashboard page (`/src/app/dashboard/page.tsx`) serves as the central hub for the Medcare AI Forecast application. It provides a high-level summary of network health, key performance indicators (KPIs), AI engine status, and inventory insights. It aggregates data from multiple modules to offer a holistic view for executive decision-making.

## Components Used
- `PageHeader`
- `KpiCards`
- `NetworkHealth`
- `PriorityActions`
- `AIEngineStatus`
- `DemandForecastChart`
- `InventoryHealthChart`
- `ExpiryRiskPanel`
- `InventoryDistribution`
- `AIRecommendations`
- `OptimizationSummary`
- `WhatIfSimulation`
- `ExecutiveDecisionPanel`

## Required Backend APIs with Response Structures

To fully power the Dashboard page, the following backend endpoints are required. Each API must return data conforming to the expected JSON structures below.

### 1. KPI & Overview
- **`GET /api/dashboard/kpi`**
  - **Purpose:** Fetches top-level metrics such as total inventory value, overall stockout risk percentage, total potential expiry cost, and forecast accuracy.
  - **Expected Response (`DashboardKPIs`):**
    ```json
    {
      "totalInventoryValue": 1245000,
      "skusMonitored": 845,
      "stockoutRiskItems": 12,
      "expiryRiskItems": 8,
      "onTimeDeliveryRate": 94.2,
      "forecastAccuracy": 88.5,
      "activeAlerts": 4,
      "pendingRecommendations": 5
    }
    ```

### 2. Network & Engine Status
- **`GET /api/network/health`**
  - **Purpose:** Returns the operational status and capacity of network components (hospitals, distribution centers).
  - **Expected Response (`NetworkHealth`):**
    ```json
    {
      "overallScore": 92,
      "inStockPercentage": 96.5,
      "atRiskSkuCount": 12,
      "excessInventoryValue": 45000,
      "shortageValue": 12500
    }
    ```
- **`GET /api/ai/status`**
  - **Purpose:** Returns the status of the AI models (e.g., last trained, current confidence score, system load).
  - **Expected Response:**
    ```json
    {
      "engineStatus": "online",
      "lastTrained": "2024-03-15T10:00:00Z",
      "confidenceScore": 94,
      "activeModels": 3
    }
    ```

### 3. Actionable Items
- **`GET /api/alerts/priority`**
  - **Purpose:** Fetches a limited list of high-priority alerts that require immediate attention.
  - **Expected Response (`PriorityAction[]`):**
    ```json
    [
      {
        "id": "ACT-001",
        "sku": "SKU-LIS-10",
        "dc": "Northeast DC",
        "problem": "Projected Stockout (4 days)",
        "severity": "critical",
        "recommendedAction": "Expedite Air Freight"
      }
    ]
    ```

### 4. Analytical Charts
- **`GET /api/forecast/demand-summary`**
  - **Purpose:** Provides time-series data for the demand forecast chart (historical vs. predicted).
  - **Expected Response (`Record<string, ForecastPoint[]>`):**
    ```json
    {
      "SKU-LIS-10": [
        {
          "date": "2024-03-15T00:00:00Z",
          "actualDemand": 160,
          "predictedDemand": 150,
          "lowerBound": 120,
          "upperBound": 190
        }
      ]
    }
    ```
- **`GET /api/inventory/health-summary`**
  - **Purpose:** Summarizes inventory levels into categories like "Healthy", "Overstock", and "Low Stock".
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
- **`GET /api/inventory/distribution`**
  - **Purpose:** Provides data on how inventory is distributed geographically or by category.
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

### 5. Expiry Risk
- **`GET /api/inventory/expiry-risk-summary`**
  - **Purpose:** Highlights top batches nearing expiry and their associated financial risk.
  - **Expected Response (`ExpiryRiskItem[]`):**
    ```json
    [
      {
        "id": "EXP-001",
        "sku": "SKU-OME-20",
        "name": "Omeprazole 20mg Capsules",
        "batchId": "B-2024-89A",
        "currentQuantity": 250,
        "daysToExpiry": 12,
        "inventoryValue": 30,
        "dc": "South DC",
        "severity": "critical"
      }
    ]
    ```

### 6. Decision & Optimization
- **`GET /api/recommendations/summary`**
  - **Purpose:** Fetches the top AI-generated recommendations for inventory optimization.
  - **Expected Response (`ReplenishmentRecommendation[]`):**
    ```json
    [
      {
        "id": "REC-001",
        "itemId": "SKU-LIS-10",
        "action": "order",
        "destinationDc": "Northeast DC",
        "currentInventory": 800,
        "forecastDemand": 2100,
        "riskStatus": "critical",
        "suggestedQuantity": 5000,
        "confidenceScore": 94,
        "estimatedDeliveryDate": "2024-03-29T00:00:00Z",
        "reason": "Projected stockout in 4 days...",
        "expectedImpact": "Avoids $45k in stockout penalties",
        "priority": "critical"
      }
    ]
    ```
- **`GET /api/optimization/summary`**
  - **Purpose:** Returns metrics on potential cost savings and efficiency gains.
  - **Expected Response (`OptimizationMetrics`):**
    ```json
    {
      "current": {
        "holdingCost": 28500,
        "stockoutPenalty": 14200,
        "expiryCost": 5400,
        "transferCost": 1200,
        "totalCost": 49300
      },
      "optimized": {
        "holdingCost": 24100,
        "stockoutPenalty": 2100,
        "expiryCost": 1800,
        "transferCost": 3500,
        "totalCost": 31500
      },
      "savings": 17800,
      "savingsPercentage": 36.1
    }
    ```
- **`GET /api/simulation/quick-scenarios`**
  - **Purpose:** Returns data for quick "what-if" simulations on the dashboard.
  - **Expected Response (`SimulationResult[]`):**
    ```json
    [
      {
        "scenarioId": "SIM-001",
        "scenarioName": "Expedited Air Freight (Lisinopril)",
        "projectedStockoutRisk": 5.2,
        "estimatedCostSavings": -1200,
        "impactScore": 85
      }
    ]
    ```
