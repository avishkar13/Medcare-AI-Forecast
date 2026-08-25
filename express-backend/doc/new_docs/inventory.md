# Inventory API

Manages physical stock levels, item master data, and network metrics.

## Endpoints

### 1. `GET /api/inventory`
Retrieves a paginated list of inventory items and their current status.

### 2. `GET /api/inventory/:id`
Retrieves detailed information for a single SKU.

### 3. `POST /api/inventory`
Creates a new inventory record.

### 4. `PUT /api/inventory/:id`
Updates an existing inventory record.

### 5. `DELETE /api/inventory/:id`
Removes an inventory record.

### 6. `GET /api/inventory/metrics/kpi`
Returns inventory-specific KPIs (total value, active SKUs, risk items).

### 7. `GET /api/inventory/metrics/health`
Returns network health scores.

### 8. `GET /api/inventory/metrics/network`
Returns the distribution of inventory health statuses.
