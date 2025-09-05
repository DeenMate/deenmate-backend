# DeenMate Backend — Scaffold Proposal (Sprint 0)

Date: 2025-09-03
Owner: Backend Lead (Cursor)

---

## Repository Structure (to create)

```
/src
  /api
    /quran
    /prayer
    /hadith
    /zakat
    /auth
    /settings
    app.controller.ts (health)
  /services
  /models
  /schemas
  /db
    /migrations
    /seed
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

## Initial Files & Stubs

- Health endpoints: `/health`, `/ready`
- Config module: environment validation (port, DB, Redis, API bases, keys)
- Providers/clients: Quran.com, Aladhan, MetalpriceAPI, Sunnah (feature-flag)
- Redis client wrapper (ioredis)
- Error filter + validation pipe defaults
- Logger (JSON), request ID middleware

---

## Docker & Compose Outline

docker-compose.yml services:
- postgres: 15+, port 5432, volume `pgdata`, healthcheck
- redis: 7+, port 6379, healthcheck
- api: build Dockerfile, depends_on postgres,redis; exposes 3000
- pgweb or adminer: optional DB UI

Dockerfile (Node 20 LTS):
- multi-stage build
- install deps, build, run `node dist/main`

---

## .env.example Keys

- APP_PORT=3000
- NODE_ENV=development
- DATABASE_URL=postgresql://postgres:postgres@postgres:5432/deenmate?schema=public
- REDIS_URL=redis://redis:6379
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

## CI Pipeline (GitHub Actions)

Jobs:
- setup-node + pnpm cache
- lint (eslint), typecheck (tsc --noEmit), test (jest --coverage)
- build (nest build / tsc)
- docker build (optional on main)

Branch rules:
- require status checks: lint, typecheck, test, build

---

## Definition of Done (Sprint 0)

- `docker-compose up` brings postgres, redis, and boots API health endpoint
- CI passing on PR
- `.env.example` comprehensive & documented
- README updated with quick start
