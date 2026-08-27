# Backend API documentation

One file per route group. Shared behaviour — the response envelope, error codes,
headers and rate-limit tiers — lives in [`conventions.api.md`](conventions.api.md)
and is not repeated per group.

| Group | Mounted at | Doc |
| --- | --- | --- |
| health | `/api/health` | [health.api.md](health.api.md) |
| masterdata | `/api` | [masterdata.api.md](masterdata.api.md) |
| dashboard | `/api/dashboard` | [dashboard.api.md](dashboard.api.md) |
| inventory | `/api/inventory` | [inventory.api.md](inventory.api.md) |
| movements | `/api/dc`, `/api/inventory/movements`, `/api/restock-requests` | [movements.api.md](movements.api.md) |
| planning | `/api/planning` | [planning.api.md](planning.api.md) |
| scenarios | `/api/scenarios` | [scenarios.api.md](scenarios.api.md) |
| forecast | `/api/forecast` | [forecast.api.md](forecast.api.md) |
| recommendations | `/api/recommendations` | [recommendations.api.md](recommendations.api.md) |
| alerts | `/api/alerts` | [alerts.api.md](alerts.api.md) |
| expiry | `/api/expiry` | [expiry.api.md](expiry.api.md) |
| simulation | `/api/simulation` | [simulation.api.md](simulation.api.md) |
| settings | `/api/settings` | [settings.api.md](settings.api.md) |
| parameters | `/api/planning/parameters` | [parameters.api.md](parameters.api.md) |
| models | `/api/planning/models` | [models.api.md](models.api.md) |
| plans | `/api/supply-plans`, `/api/drp-plans` | [plans.api.md](plans.api.md) |
| training | `/api/training-data` | [training.api.md](training.api.md) |

Not route groups:

- [`planning.executor.md`](planning.executor.md) — what turns a `PENDING` run into a `COMPLETED` one
- [`forecast.contract.md`](forecast.contract.md) — the wire contract with the Python engine

## A note on `new_docs/`

`doc/new_docs/` held short summaries of the alerts, expiry, forecast, recommendations,
settings and simulation groups. Those groups have since been rewritten — the response
shapes, the query parameters and the error codes all changed — so the summaries
described an API that no longer exists. They were removed rather than left to be read
as current; each group now has a full file above.
