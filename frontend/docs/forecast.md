# Forecast Page Analysis

## Overview
The Forecast page (`/src/app/forecast/page.tsx`) provides deep insights into demand forecasting. It offers time-series predictions, network-wide forecast analysis, seasonality insights, and performance tracking of the forecast models, down to the SKU level.

## Components Used
- `ForecastHeader`
- `ForecastControlBar`
- `ForecastKpiCards`
- `ForecastMainChart`
- `ForecastSummaryPanel`
- `ForecastTrend`
- `ForecastInsight`
- `ForecastNetwork`
- `ForecastSeasonality`
- `ForecastPerformance`
- `ForecastImpact`
- `ForecastSkuTable`

## Required Backend APIs with Response Structures

To fully power the Forecast page, the following backend endpoints are required. Each API must return data conforming to the expected JSON structures below.

### 1. Forecast Controls & Top-Level Metrics
- **`GET /api/forecast/kpi`**
  - **Purpose:** Fetches KPI metrics for forecasting.
  - **Expected Response (`ForecastPageKPIs`):**
    ```json
    {
      "forecastedDemand": 12480,
      "forecastHorizonDays": 30,
      "forecastAccuracy": 88.5,
      "accuracyChange": 1.2,
      "confidenceLevel": 94,
      "expectedPeakDemand": 620,
      "peakDate": "2024-04-12T00:00:00Z",
      "demandGrowth": 8.4
    }
    ```
- **`GET /api/forecast/summary`**
  - **Purpose:** Returns the summary metrics for the selected forecast period and parameters.
  - **Expected Response (`ForecastSummaryData`):**
    ```json
    {
      "predictedPeak": 620,
      "peakDate": "2024-04-12T00:00:00Z",
      "avgDailyDemand": 416,
      "minExpectedDemand": 390,
      "maxExpectedDemand": 710,
      "confidenceRange": [540, 690],
      "historicalAccuracy": 88.5,
      "expectedTrend": "Growing"
    }
    ```

### 2. Time-Series & Analytical Charts
- **`GET /api/forecast/main-chart`**
  - **Purpose:** Provides historical and forecasted time-series demand data.
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
- **`GET /api/forecast/trend`**
  - **Purpose:** Returns trend analysis (e.g., YoY growth, moving averages).
  - **Expected Response (`ForecastTrendData`):**
    ```json
    {
      "sevenDayTrend": 4.2,
      "thirtyDayTrend": 8.4,
      "seasonalPattern": "Weekly (Tue-Thu peaks)",
      "growthRate": 12.5,
      "demandVolatility": "Low"
    }
    ```
- **`GET /api/forecast/seasonality`**
  - **Purpose:** Returns seasonal variation data to highlight recurring demand patterns.
  - **Expected Response (`SeasonalityData`):**
    ```json
    {
      "weeklyPattern": [
        { "day": "Mon", "value": 105 },
        { "day": "Tue", "value": 120 }
      ],
      "monthlyTrend": [
        { "month": "Jan", "value": 110 }
      ],
      "seasonalUplift": 14.5,
      "volatility": "Low (Stable predictable peaks)"
    }
    ```
- **`GET /api/forecast/network`**
  - **Purpose:** Returns forecast demand broken down by network nodes.
  - **Expected Response (`NetworkForecastItem[]`):**
    ```json
    [
      {
        "id": "DC-01",
        "dcName": "Northeast DC",
        "currentDemand": 4200,
        "forecastDemand": 4650,
        "growth": 10.7,
        "confidence": 94,
        "peakDemand": 4800,
        "peakDate": "2024-04-12T00:00:00Z"
      }
    ]
    ```

### 3. Model Insights & Performance
- **`GET /api/forecast/insight`**
  - **Purpose:** Returns AI-generated textual insights on current forecast drivers.
  - **Expected Response (`ForecastInsightData`):**
    ```json
    {
      "keyDriver": "Recurring weekly pattern + Northeast DC volume increase",
      "riskImplication": "Inventory may fall below safety stock during peak",
      "confidence": "High",
      "recommendedAttention": "Review replenishment schedule",
      "detailedInsight": "Demand is expected to increase by 8.4%..."
    }
    ```
- **`GET /api/forecast/performance`**
  - **Purpose:** Returns historical model performance data.
  - **Expected Response (`ModelPerformanceItem[]`):**
    ```json
    [
      {
        "modelName": "AI Ensemble",
        "mape": 4.2,
        "mae": 12.5,
        "rmse": 15.8,
        "accuracy": 95.8,
        "bias": 0.4,
        "isPrimary": true
      }
    ]
    ```
- **`GET /api/forecast/impact`**
  - **Purpose:** Returns the operational and financial impact of the forecasted demand.
  - **Expected Response (`ForecastImpactData`):**
    ```json
    {
      "stockoutRiskReduction": 14,
      "safetyStockOptimization": 8,
      "reorderQuantityChange": -3.5,
      "excessInventoryReduction": 17800,
      "expectedInventoryValue": 1227200,
      "insightText": "Improved forecast accuracy is expected to reduce stockout exposure by 14%..."
    }
    ```

### 4. SKU-Level Forecast Data
- **`GET /api/forecast/skus`**
  - **Purpose:** Fetches detailed forecast tabular data broken down by individual SKUs.
  - **Expected Response (`ForecastTableItem[]`):**
    ```json
    [
      {
        "id": "SKU-LIS-10",
        "product": "Lisinopril 10mg Tablets",
        "category": "Cardiovascular",
        "currentDemand": 165,
        "forecastDemand": 179,
        "growth": 8.4,
        "accuracy": 94.2,
        "confidence": 96,
        "trend": "Growing",
        "risk": "Critical"
      }
    ]
    ```
