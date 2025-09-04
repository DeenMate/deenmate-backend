# DeenMate Backend — Development Guide

Date: 2025-09-03
Owner: Backend Lead (Cursor)

---

## Prerequisites

- Node.js LTS, pnpm or npm
- Docker Desktop (for Postgres/Redis)
- Make (optional), Git

---

## Environment Variables (.env.example)

Required keys (no secrets in repo; provide sample placeholders):

- APP_PORT=3000
- NODE_ENV=development
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/deenmate
- REDIS_URL=redis://localhost:6379
- JWT_PUBLIC_KEY=base64-encoded
- JWT_PRIVATE_KEY=base64-encoded
- CDN_SIGNING_KEY=change-me
- QURAN_API_BASE=https://api.quran.com/api/v4
- ALADHAN_API_BASE=https://api.aladhan.com/v1
- SUNNAH_API_BASE=https://api.sunnah.com/v1
- SUNNAH_API_KEY=your-key
- METALPRICE_API_BASE=https://api.metalpriceapi.com/v1
- METALPRICE_API_KEY=your-key
- AUDIO_CDN_BASE=https://audio.qurancdn.com
- R2_ENDPOINT=your-r2-endpoint
- R2_ACCESS_KEY_ID=your-key
- R2_SECRET_ACCESS_KEY=your-secret
- R2_BUCKET=deenmate-audio

---

## Local Setup

1) Copy env and start services
- cp .env.example .env
- docker-compose up -d postgres redis

2) Install and bootstrap
- pnpm install
- pnpm prisma migrate dev
- pnpm prisma generate

3) Run app
- pnpm start:dev

4) Run tests & lint
- pnpm test
- pnpm lint
- pnpm typecheck

---

## Repository Structure (expected)

```
/src
  /api
  /services
  /models
  /schemas
  /db
  /jobs
  /workers
  /utils
/tests
/docs
  /backend
openapi.yaml
Dockerfile
docker-compose.yml
.github/workflows/ci.yml
README.md
CONTRIBUTING.md
.env.example
```

---

## Branching & PR Workflow

- main: protected; squash merges only
- branch naming: type/scope-detail (feat/quran/api, chore/ci)
- PR size: <500 lines preferred; include checklist linking TODO items
- Require green CI (lint, typecheck, test, build) before merge

---

## Testing Strategy

- Unit: services, utils (Jest); 60%+ coverage for services
- Integration: controllers with in-memory DB or test DB via docker
- Contract: OpenAPI schema validation; supertest for happy paths
- Workers: job handlers with mocked providers and Redis

---

## Observability (Dev)

- Enable request logging (JSON) with request_id
- Expose /health, /ready
- Prometheus metrics at /metrics (dev only)

---

## Security Hygiene

- Do not commit secrets; use .env and platform secrets
- Validate inputs with DTOs; sanitize outputs
- Set sensible rate limits in dev to avoid provider bans

---

## CI/CD

- GitHub Actions jobs: install → lint → typecheck → test → build → docker
- Artifacts: Docker image tagged with commit SHA
- Staging deploy: Railway or Fly using env group; migrations run on release

---

## Developer Runbooks

- Sync failures: check provider status, backoff config, Redis queues
- Cache misses: verify keys and TTLs; inspect Redis
- Database issues: run prisma studio, confirm migrations applied
- Rate-limit trips: adjust thresholds in dev only, never remove guards
