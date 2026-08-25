# Settings API

Manages deeply nested system, UI, integration, and AI configurations.

## Endpoints

### 1. `GET /api/settings`
Retrieves the global application settings. 
- **Implementation Note**: The backend queries 8 distinct relational tables (GeneralSettings, ForecastSettings, InventorySettings, AlertSettings, NotificationSettings, AISettings, IntegrationSettings, SecuritySettings) utilizing Prisma's `include` mechanism, and deeply merges them back into a single unified JSON payload matching the frontend's expected format.

### 2. `PATCH /api/settings`
Updates the global application settings. 
- **Implementation Note**: Takes a single unified JSON payload from the frontend and breaks it apart into deeply nested Prisma `create` queries. It deletes the previous configuration tree to ensure absolute synchronization with the strict relational database models without relying on unstructured JSON blobs.

### 3. `POST /api/settings/test-integration`
Tests connectivity with external ERP/inventory systems.

### 4. `POST /api/settings/reset-password`
Initiates a password reset flow.
