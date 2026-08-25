# Recommendations Page Analysis

## Overview
The Recommendations page (`/src/app/recommendations/page.tsx`) provides an actionable list of AI-generated suggestions to optimize the supply chain. Users can review, execute, or dismiss recommendations, view the potential impact, and understand the intelligence and framework behind the AI suggestions.

## Components Used
- `RecommendationsHeader`
- `RecommendationsKpiCards`
- `RecommendationsFilters`
- `RecommendationList`
- `RecommendationImpact`
- `RecommendationIntelligenceCard`
- `RecommendationSummary`
- `RecommendationFramework`

## Required Backend APIs with Response Structures

To fully power the Recommendations page, the following backend endpoints are required. Each API must return data conforming to the expected JSON structures below.

### 1. KPI & Impact Metrics
- **`GET /api/recommendations/kpi`**
  - **Purpose:** Fetches high-level metrics for the recommendations engine.
  - **Expected Response:**
    ```json
    {
      "totalRecommendations": 12,
      "potentialSavings": 17800,
      "executionRate": 85.5
    }
    ```
- **`GET /api/recommendations/impact`**
  - **Purpose:** Returns data estimating the financial and operational impact of executing the recommended actions.
  - **Expected Response (`RecommendationImpact`):**
    ```json
    {
      "currentSupplyChainCost": 49300,
      "aiOptimizedCost": 31500,
      "projectedSavings": 17800,
      "costReductionPercentage": 36.1,
      "categories": {
        "stockout": 45,
        "excessInventory": 30,
        "expiry": 15,
        "transfers": 10
      }
    }
    ```
- **`GET /api/recommendations/summary`**
  - **Purpose:** Provides a summarized breakdown of recommendations by category (e.g., transfers, orders, discounts).
  - **Expected Response:**
    ```json
    {
      "replenishments": 5,
      "transfers": 3,
      "expedites": 2,
      "discounts": 2
    }
    ```

### 2. Recommendations List Data
- **`GET /api/recommendations/list`**
  - **Purpose:** Fetches the main queue of AI recommendations.
  - **Query Parameters:** `search`, `priority`, `actionType`, `location`, `status` (Pending, Executed, Dismissed), `sortBy`.
  - **Expected Response (`RecommendationItem[]`):**
    ```json
    [
      {
        "id": "REC-001",
        "title": "REPLENISH 5,000 UNITS",
        "actionType": "Replenish",
        "priority": "Critical",
        "confidence": 94,
        "reason": "Projected stockout in 4 days. Supplier lead time is 14 days.",
        "sku": "SKU-LIS-10",
        "location": "Northeast DC",
        "currentStock": 800,
        "forecastDemand": 2100,
        "recommendedQuantity": 5000,
        "expectedImpact": "Avoids $45K in stockout penalties",
        "impactValue": 45000,
        "signals": [
          { "type": "Demand", "label": "Demand", "direction": "up" },
          { "type": "Risk", "label": "Stockout risk", "direction": "up" }
        ],
        "status": "Pending",
        "createdAt": "2024-03-20T10:00:00Z"
      }
    ]
    ```

### 3. Intelligence & AI Explanations
- **`GET /api/recommendations/intelligence`**
  - **Purpose:** Returns insights into how the AI model generated the current set of recommendations.
  - **Expected Response (`RecommendationIntelligence`):**
    ```json
    {
      "signals": {
        "demandForecast": 92,
        "inventoryPosition": 89,
        "leadTime": 84,
        "expiryRisk": 91
      },
      "modelConfidence": 89.4,
      "explanation": "Recommendations combine forecast demand, inventory levels..."
    }
    ```

### 4. Actions
- **`PATCH /api/recommendations/{id}/execute`**
  - **Purpose:** Triggers the execution of a specific recommendation (e.g., automatically placing an order or initiating a transfer).
  - **Expected Response:** `{ "success": true, "status": "Executed" }`
- **`PATCH /api/recommendations/{id}/dismiss`**
  - **Purpose:** Dismisses a recommendation from the queue.
  - **Expected Response:** `{ "success": true, "status": "Dismissed" }`
