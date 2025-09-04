# Backend Documentation Index

This directory organizes Backend docs.

## Project docs (working documents)
Curated working documents for current development. Update these as work progresses.

| Doc | Purpose |
|-----|---------|
| `project/PROJECT_TRACKING.md` | Sprint board and milestones |
| `project/TODO.md` | Action items and checklists |
| `project/ARCHITECTURE.md` | Implementation plan + Module breakdown |
| `project/sync-strategy.md` | Cron schedule, pre-warm plan, failure handling |

## Reference docs (stable)
Stable documents for consumers and operators.

| Doc | Purpose |
|-----|---------|
| `reference/API_GUIDE.md` | API spec overview and upstream-compat notes |
| `reference/env-config.md` | Environment variables, defaults, examples |
| `reference/observability.md` | Logging, metrics, tracing, dashboards |

## API docs (reference)
- `../api/openapi.yaml` — OpenAPI spec
- `../api/quickstart.md` — Quickstart guide
- `../api/deployment-guide.md` — Deployment guide
- `../api/postman-collection.json` — Postman collection

Notes:
- Keep Project docs updated as work progresses; summarize changes at the top of each file.
- Reference docs should change only on releases or material behavior changes.
