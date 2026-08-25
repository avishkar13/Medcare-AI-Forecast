# Simulation Page Analysis

## Overview
The Simulation page (`/src/app/simulation/page.tsx`) allows users to run "What-If" scenarios to understand the impact of various supply chain shocks, such as demand surges or supplier delays. Users can adjust parameters, view AI-generated assessments, compare different scenarios, and analyze financial and operational impacts.

## Components Used
- `SimulationHeader`
- `ScenarioSelector`
- `SimulationParameters`
- `ScenarioSummary`
- `SimulationResults`
- `InventoryImpact`
- `DistributionImpact`
- `RiskAnalysis`
- `FinancialImpact`
- `AIScenarioAssessment`
- `ScenarioComparison`
- `SimulationHistory`

## Required Backend APIs with Response Structures

To fully power the Simulation page, the following backend endpoints are required. Each API must return data conforming to the expected JSON structures below.

### 1. Simulation Engine Execution
- **`POST /api/simulation/run`**
  - **Purpose:** Executes a simulation run based on provided parameters.
  - **Request Body (`SimulationParams`):**
    ```json
    {
      "demandShock": 40,
      "inventoryAvailability": 100,
      "serviceLevelTarget": 95,
      "supplierLeadTime": 5,
      "distributionCapacity": 100,
      "transportationCost": 10
    }
    ```
  - **Expected Response (`SimulationOutput`):**
    ```json
    {
      "metrics": [
        { "id": "stockout_risk", "label": "Stockout Risk", "value": 15.2, "delta": 12.0 },
        { "id": "service_level", "label": "Service Level", "value": 84.5, "delta": -11.0 },
        { "id": "total_cost", "label": "Total Cost", "value": 125000, "delta": 24000 }
      ],
      "skuImpacts": [
        { "sku": "SKU-LIS-10", "impactScore": 92, "stockoutDays": 5 }
      ],
      "dcImpacts": [
        { "dcId": "DC-01", "capacityUtilization": 105, "bottleneck": true }
      ],
      "risks": [
        { "type": "financial", "description": "High expediting costs required", "severity": "high" }
      ],
      "financial": {
        "holdingCostChange": 2000,
        "stockoutPenaltyChange": 15000,
        "expeditingCostChange": 7000
      },
      "aiInsight": {
        "overallRisk": "critical",
        "summary": "Stockout risk increases significantly due to 40% demand surge.",
        "recommendedMitigation": "Pre-position inventory in Northeast DC."
      }
    }
    ```

### 2. Simulation State & History
- **`GET /api/simulation/history`**
  - **Purpose:** Fetches the user's history of past simulation runs.
  - **Expected Response (`SimulationHistoryItem[]`):**
    ```json
    [
      {
        "id": "sim-001",
        "scenario": "Demand Surge",
        "preset": "demand-surge",
        "date": "2026-08-25T02:05:00Z",
        "keyChange": "+40% demand",
        "riskLevel": "critical",
        "resultSummary": "Stockout risk +12%",
        "params": { 
          "demandShock": 40, 
          "inventoryAvailability": 100, 
          "supplierLeadTime": 5 
        }
      }
    ]
    ```
- **`GET /api/simulation/saved`**
  - **Purpose:** Fetches specific scenarios the user has explicitly saved for comparison.
  - **Expected Response (`SavedScenario[]`):**
    ```json
    [
      {
        "id": "saved-1001",
        "name": "Holiday Season Prep",
        "preset": "demand-surge",
        "params": { "demandShock": 25 },
        "metrics": [],
        "riskLevel": "high",
        "date": "2026-08-20T10:00:00Z"
      }
    ]
    ```

### 3. Scenario Management
- **`POST /api/simulation/save`**
  - **Purpose:** Saves the results and parameters of a simulation run as a named scenario for future comparison.
  - **Request Body:** `{ "name": "My Scenario", "preset": "demand-surge", "params": {...} }`
  - **Expected Response:** `{ "success": true, "id": "saved-1002" }`
- **`DELETE /api/simulation/saved/{id}`**
  - **Purpose:** Deletes a saved scenario.
  - **Expected Response:** `{ "success": true }`
