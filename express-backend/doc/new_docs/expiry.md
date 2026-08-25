# Expiry API

Manages shelf-life constraints and expiry risk mitigation.

## Endpoints

### 1. `GET /api/expiry/batches`
Retrieves a list of inventory batches with their respective expiry dates and calculated risk levels.

### 2. `GET /api/expiry/dc-exposure`
Returns the financial exposure to expiry waste aggregated by Distribution Center.

### 3. `GET /api/expiry/waste-prevention`
Retrieves historical records of successful AI-driven waste mitigation (e.g., proactive transfers or discounts).
