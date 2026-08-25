# Alerts Page Analysis

## Overview
The Alerts page (`/src/app/alerts/page.tsx`) provides a comprehensive system for monitoring, filtering, and managing system alerts. It allows users to view active alerts, review their details, acknowledge them, or resolve them. It also includes sections for overall monitoring health, alert trends, and geographical/categorical distribution of alerts.

## Components Used
- `AlertsHeader`
- `AlertOverview`
- `AlertFilters`
- `ActiveAlertList`
- `AlertDetailsSheet`
- `AlertTrends`
- `MonitoringHealth`
- `AlertDistribution`

## Required Backend APIs with Response Structures

To fully power the Alerts page, the following backend endpoints are required. Each API must return data conforming to the expected JSON structures below.

### 1. Alert Data
- **`GET /api/alerts`**
  - **Purpose:** Fetches a list of system alerts.
  - **Query Parameters:** `status`, `severity`, `type`, `location`, `search`, `sortBy`, `window`.
  - **Expected Response (`SystemAlert[]`):**
    ```json
    [
      {
        "id": "ALT-1001",
        "severity": "critical",
        "type": "stockout_risk",
        "title": "Projected stockout for Lisinopril 10mg",
        "sku": "SKU-LIS-10",
        "product": "Lisinopril 10mg",
        "location": "Northeast DC",
        "detectedAt": "2024-03-20T10:30:00Z",
        "businessImpact": "$45K potential stockout penalty",
        "status": "new",
        "recommendedAction": "Replenish 5,000 units",
        "explanation": "Projected demand is expected to exceed available inventory...",
        "metrics": [
          { "label": "Current Stock", "value": "800 units" },
          { "label": "Stockout Probability", "value": "87%" }
        ],
        "timeline": [
          { "time": "2024-03-20T08:00:00Z", "description": "Demand forecast updated" }
        ]
      }
    ]
    ```
- **`GET /api/alerts/{id}`**
  - **Purpose:** Fetches detailed information for a specific alert.
  - **Expected Response (`SystemAlert`):** Same structure as a single object from the list above.

### 2. Analytics & Overview
- **`GET /api/alerts/overview`**
  - **Purpose:** Returns overview statistics.
  - **Expected Response (`AlertOverviewData`):**
    ```json
    {
      "criticalCount": 3,
      "highCount": 7,
      "unresolvedCount": 12,
      "todayCount": 18,
      "todayDelta": 4,
      "resolvedCount": 24,
      "resolvedPercentage": 92
    }
    ```
- **`GET /api/alerts/trends`**
  - **Purpose:** Returns time-series data showing alert trends.
  - **Expected Response:**
    ```json
    [
      {
        "date": "2024-03-15",
        "critical": 2,
        "high": 4,
        "medium": 10
      }
    ]
    ```
- **`GET /api/alerts/distribution`**
  - **Purpose:** Returns data showing how alerts are distributed by category, severity, or location.
  - **Expected Response:**
    ```json
    {
      "byLocation": { "Northeast DC": 5, "South DC": 3 },
      "byType": { "stockout_risk": 4, "expiry_risk": 2 }
    }
    ```
- **`GET /api/alerts/health`**
  - **Purpose:** Returns monitoring health status metrics.
  - **Expected Response:**
    ```json
    {
      "systemUptime": 99.9,
      "sensorsActive": 1420,
      "lastSync": "2024-03-20T10:45:00Z"
    }
    ```

### 3. Actions
- **`PATCH /api/alerts/{id}/acknowledge`**
  - **Purpose:** Marks a specific alert as acknowledged by the user.
  - **Expected Response:** `{ "success": true, "status": "acknowledged" }`
- **`PATCH /api/alerts/{id}/resolve`**
  - **Purpose:** Marks a specific alert as resolved.
  - **Expected Response:** `{ "success": true, "status": "resolved" }`
- **`POST /api/alerts/mark-all-read`**
  - **Purpose:** Acknowledges all "new" alerts in a single action.
  - **Expected Response:** `{ "success": true, "updatedCount": 5 }`
