# DeenMate API

Production backend for DeenMate — Islamic content APIs

## API Docs (Swagger)

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`
- Global prefix: `/api/v1` (all routes are shown under this prefix)
- Auth: Use Bearer token in the Authorize button as `Bearer <token>`

To view locally:
1. Install deps and start the server
2. Visit the URLs above

For staging/production, the same paths are available under the deployed base URL.

## Quick Start (Sprint 0)

1. Prerequisites: Node 20, Docker
2. Copy env and start infra:
   - cp .env.example .env
   - docker-compose up -d postgres redis pgweb
3. Install deps and build (once code is scaffolded):
   - npm ci
   - npm run build
4. OpenAPI: see `openapi.yaml`
5. CI: GitHub Actions at `.github/workflows/ci.yml`

Docs: see `docs/backend/` for specs, schema, security, observability, and plans.
