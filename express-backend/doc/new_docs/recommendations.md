# Recommendations API

Provides AI-driven supply chain actions (transfers, expedites, production orders).

## Endpoints

### 1. `GET /api/recommendations`
Retrieves the list of recommended actions. Now strictly includes nested `signals` data from the `RecommendationSignal` relation model.

### 2. `GET /api/recommendations/kpi`
Returns the total recommendations, potential savings, and execution rate.

### 3. `GET /api/recommendations/impact`
Returns the projected financial savings categorized by action type.

### 4. `GET /api/recommendations/summary`
Provides a categorical breakdown of recommendation types.

### 5. `GET /api/recommendations/intelligence`
Returns the AI model confidence and decision factor weightings.

### 6. `POST /api/recommendations/:id/execute`
Marks a recommendation as executed/completed.

### 7. `POST /api/recommendations/:id/dismiss`
Marks a recommendation as dismissed/rejected.
