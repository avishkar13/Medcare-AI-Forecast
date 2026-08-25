# Settings Page Analysis

## Overview
The Settings page (`/src/app/settings/page.tsx`) provides a comprehensive interface for configuring system-wide preferences and parameters. It handles general application settings, forecasting controls, inventory thresholds, alerts, notifications, AI configurations, integrations, and security.

## Components Used
- `SettingsNavigation`
- `GeneralSettings`
- `ForecastSettings`
- `InventorySettings`
- `AlertSettings`
- `NotificationSettings`
- `AISettings`
- `IntegrationSettings`
- `SecuritySettings`

## Required Backend APIs with Response Structures

To fully power the Settings page, the following backend endpoints are required. Each API must return data conforming to the expected JSON structures below.

### 1. Fetching Settings Data
- **`GET /api/settings`**
  - **Purpose:** Fetches all configuration properties and preferences for the current user and/or organization.
  - **Expected Response (`AppSettings`):**
    ```json
    {
      "general": {
        "organizationName": "Medcare Health Network",
        "timeZone": "UTC",
        "currency": "USD"
      },
      "forecast": {
        "defaultHorizonDays": 30,
        "confidenceThreshold": 85,
        "useSeasonality": true
      },
      "inventory": {
        "defaultSafetyStockDays": 14,
        "stockoutRiskThreshold": 5,
        "expiryRiskThresholdDays": 90
      },
      "alerts": {
        "enablePushNotifications": true,
        "criticalAlertsEmail": "admin@medcare.com"
      },
      "notifications": {
        "dailySummary": true,
        "weeklyReport": true
      },
      "ai": {
        "autoExecuteTransfers": false,
        "autoExecuteOrders": false,
        "confidenceRequiredForAutomation": 95
      },
      "integrations": {
        "erpSystem": "SAP S/4HANA",
        "erpStatus": "connected",
        "lastSync": "2024-03-20T10:00:00Z"
      },
      "security": {
        "mfaEnabled": true,
        "sessionTimeoutMinutes": 60
      }
    }
    ```
- **`GET /api/settings/{section}`** *(Optional)*
  - **Purpose:** Fetches settings for a specific section if they are loaded on-demand.

### 2. Updating Settings Data
- **`PATCH /api/settings`** (or `PUT /api/settings`)
  - **Purpose:** Saves updates to the configuration. The payload contains the modifications to any nested sections.
  - **Request Body (Example):**
    ```json
    {
      "forecast": {
        "defaultHorizonDays": 45
      }
    }
    ```
  - **Expected Response:** `{ "success": true, "updatedSettings": { ... } }`

### 3. Integrations & Security (Specific endpoints)
- **`POST /api/settings/integrations/test`**
  - **Purpose:** Tests connectivity to a 3rd-party integration (e.g., ERP, EHR system).
  - **Expected Response:** `{ "success": true, "message": "Connection successful", "latencyMs": 145 }`
- **`POST /api/settings/security/reset-password`**
  - **Purpose:** Triggers a password reset or MFA setup workflow.
  - **Expected Response:** `{ "success": true, "message": "Password reset email sent." }`
