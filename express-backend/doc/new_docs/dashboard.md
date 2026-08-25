# Dashboard API

Provides high-level summaries and network-wide KPIs for the main dashboard view.

## Endpoints

### 1. `GET /api/dashboard/summary`
Returns the top-level KPIs including total inventory value, stockout risks, etc.

### 2. `GET /api/dashboard/network`
Returns network health scores, in-stock percentages, and value shortages.

### 3. `GET /api/dashboard/inventory-health`
Returns a breakdown of inventory statuses (healthy, at-risk, excess).

### 4. `GET /api/dashboard/expiry-risk`
Provides an aggregated view of expiry risks across all distribution centers.

### 5. `GET /api/dashboard/priority-actions`
Lists the top critical actions (stockouts, urgent transfers) requiring immediate planner attention.
