# Alerts API

Manages system-generated alerts for stockouts, demand spikes, and expiry risks.

## Endpoints

### 1. `GET /api/alerts`
Retrieves a paginated list of alerts.
- **Response**: Array of `Alert` objects including nested `metrics` and `timeline` data from strict relational tables.

### 2. `GET /api/alerts/overview`
Retrieves aggregate counts (critical, high, unresolved, today's delta, resolved percentage).

### 3. `GET /api/alerts/trends`
Provides time-series data of alert volumes by severity.

### 4. `GET /api/alerts/distribution`
Provides a breakdown of alerts by location and by alert type.

### 5. `GET /api/alerts/health`
Returns system health metrics (uptime, active sensors).

### 6. `PATCH /api/alerts/:id/acknowledge`
Marks an alert as acknowledged.

### 7. `PATCH /api/alerts/:id/resolve`
Marks an alert as resolved.

### 8. `POST /api/alerts/mark-all-read`
Bulk updates all 'new' alerts to 'acknowledged' status.
