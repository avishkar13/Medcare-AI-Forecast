# Expiry Risk Page Analysis

## Overview
The Expiry Risk page (`/src/app/expiry/page.tsx`) focuses on monitoring and mitigating financial and inventory risk due to product expiration. It highlights batches at risk, applies FEFO (First Expired, First Out) optimization, analyzes demand against expiring stock, and tracks prevented waste.

## Components Used
- `ExpiryHeader`
- `ExpiryOverview`
- `ExpiryFilters`
- `ExpiryExposure`
- `ExpiryTimeline`
- `AtRiskBatchTable`
- `FEFOPriorityQueue`
- `DemandExpiryAnalysis`
- `AIExpiryAssessment`
- `WastePreventionImpact`
- `DCExpiryExposure`
- `PreventedWaste`
- `BatchDetailsSheet`

## Required Backend APIs with Response Structures

To fully power the Expiry Risk page, the following backend endpoints are required. Each API must return data conforming to the expected JSON structures below.

### 1. Batch Expiry Data
- **`GET /api/expiry/batches`**
  - **Purpose:** Fetches a detailed list of batches that are nearing expiration.
  - **Expected Response (`ExpiryBatch[]`):**
    ```json
    [
      {
        "id": "B-2024-LIS-01",
        "sku": "SKU-LIS-10",
        "productName": "Lisinopril 10mg Tablets",
        "location": "Northeast DC - Bay A-04",
        "quantity": 500,
        "manufacturingDate": "2024-03-15",
        "expiryDate": "2024-05-30T00:00:00Z",
        "daysRemaining": 46,
        "valueAtRisk": 110,
        "expiryRisk": "critical",
        "riskLevel": "critical",
        "wasteValue": 110,
        "demandCoverage": 45,
        "inventoryValue": 110,
        "batchNumber": "LOT-8942"
      }
    ]
    ```

### 2. Expiry Analytics & Overviews
- **`GET /api/expiry/overview`**
  - **Purpose:** Returns high-level expiry metrics.
  - **Expected Response:**
    ```json
    {
      "totalAtRiskValue": 45000,
      "criticalBatchesCount": 12,
      "preventedWaste": 12500,
      "averageDaysToExpiry": 85
    }
    ```
- **`GET /api/expiry/timeline`**
  - **Purpose:** Returns the timeline of upcoming expirations across the network.
  - **Expected Response:**
    ```json
    [
      {
        "month": "2024-04",
        "valueExpiring": 5400,
        "batchCount": 3
      }
    ]
    ```
- **`GET /api/expiry/dc-exposure`**
  - **Purpose:** Returns financial exposure specifically segmented by Distribution Center (DC).
  - **Expected Response (`DistributionCenterExpiry[]`):**
    ```json
    [
      {
        "dcId": "DC-01",
        "dcName": "Northeast DC",
        "totalExposureValue": 15400,
        "criticalExposure": 4500
      }
    ]
    ```

### 3. AI Assessment & Waste Prevention
- **`GET /api/expiry/ai-assessment`**
  - **Purpose:** Returns AI-generated insights and text assessment on the overall expiry risk state.
  - **Expected Response:**
    ```json
    {
      "riskAssessment": "Elevated risk in West Coast DC due to slow-moving inventory.",
      "recommendedStrategy": "Initiate network transfer for Cetirizine 10mg.",
      "confidence": 88
    }
    ```
- **`GET /api/expiry/waste-prevention`**
  - **Purpose:** Returns metrics and historical data on waste prevented through early interventions.
  - **Expected Response (`WastePreventionRecord[]`):**
    ```json
    [
      {
        "id": "WP-1001",
        "date": "2024-03-10T00:00:00Z",
        "action": "Internal Transfer",
        "sku": "SKU-OME-20",
        "valueSaved": 1200,
        "description": "Transferred 1500 units to South DC to meet demand."
      }
    ]
    ```

### 4. Actions
- **`POST /api/expiry/batches/{id}/prioritize`**
  - **Purpose:** Marks a specific batch for priority usage/transfer (FEFO override).
  - **Expected Response:** `{ "success": true, "status": "prioritized" }`
