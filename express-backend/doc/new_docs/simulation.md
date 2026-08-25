# Simulation API

Provides a Monte Carlo/what-if simulation engine for stress testing the supply chain.

## Endpoints

### 1. `POST /api/simulation/run`
Executes a simulation based on user parameters (demand shock, lead time delays, etc.).
- **Response**: Returns scenario results containing dynamically mapped structural metrics (`metrics`, `dcImpacts`, `skuImpacts`, `risks`) adhering to the frontend TS types.

### 2. `GET /api/simulation/history`
Retrieves past simulation runs from the `Scenario` database table.

### 3. `GET /api/simulation/saved`
Retrieves simulation presets explicitly saved by users.

### 4. `POST /api/simulation/save`
Saves the current simulation parameters as a custom scenario in the database.

### 5. `DELETE /api/simulation/saved/:id`
Deletes a saved scenario from the database.
