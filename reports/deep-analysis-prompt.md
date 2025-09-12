Prompt — Full Deep Analysis, Verification & Docs Update (Backend + Admin Dashboard)
You are a senior backend architect, security reviewer, QA engineer and technical writer.  
You have access to the DeenMate repository (backend + admin dashboard) and must perform a **deep, deterministic analysis** of the entire project. Use the repository code, existing docs, and runtime environment to verify behavior. Do not ask clarifying questions — make reasonable technical assumptions and document them.

**Primary goals**
1. Deeply analyze the backend and admin dashboard (source code, DB schemas, OpenAPI/Swagger, sync logic, queues, cron jobs, tests, infra scripts).
2. Verify all public and admin API endpoints are production-ready for publication (correct shape, status codes, stable schema).
3. Validate database schemas and actual DB contents (data counts, translation coverage, last sync timestamps).
4. Identify every error, bug, missing feature, or inconsistency and record them into `PROJECT_STATUS.md` as tracked tasks (with IDs, priorities, owner suggestions and estimates).
5. If the project context (`PROJECT_CONTEXT.md`) requires updates (architecture change, new assumptions, or missing facts discovered), modify it and commit the proposed changes.
6. Produce a full, actionable analysis report and automated check scripts.

**Environment**
- Run locally or in staging (whichever is available). If credentials are needed, assume they are available in `.env` or CI secrets.
- Use `npm`/`pnpm` or `yarn` commands in the repo root.
- Primary docs to treat as single source of truth:
  - `PROJECT_CONTEXT.md`
  - `PROJECT_STATUS.md`

---

## Step 0 — Setup & Sanity checks (report these results)
Run and report the exact commands and outputs:

1. Install & build:
   - `npm ci`
   - `npm run build`
   - `npm run start:dev` (or `docker-compose up --build`)
   - Report startup logs and if the server reached the listening state (port).

2. Environment and connectivity:
   - Confirm `.env` loaded; print *names* of required environment variables found (do NOT print secrets).
   - DB reachable? Run: `npx prisma migrate status` (or your migration command) and paste results.
   - Redis reachable? Try a small TTL set via a node script or `redis-cli ping`.
   - Swagger/OpenAPI reachable at `http://localhost:3000/docs` and `http://localhost:3000/docs-json` — fetch and save the JSON.

3. Tests:
   - Run `npm test` and capture results.
   - If tests are missing or coverage is < 20% report as high risk.

Record results in `reports/full-deep-analysis.md` header "Environment Status".

---

## Step 1 — Static Code Discovery (list of artifacts)
Search the repository and list all relevant files (give file path and brief summary):

- List all modules under `src/modules/` and `src/` top-level.
- Locate sync code: `src/sync/`, `src/scheduler/`, `src/cron/`, `src/workers/`, `src/jobs/`.
- List DB schema files: `prisma/schema.prisma`, any SQL migration scripts, `database/` folder.
- List queue usage: `bull`, `bullmq`, `bee-queue`, or custom worker files.
- List admin endpoints: `src/modules/admin/**`
- Show OpenAPI: the `docs-json` path and file.

Produce a table: `file path | responsibility | notes`.

---

## Step 2 — DB Schema vs Project Context validation
Compare the actual DB schema (Prisma schema / migration SQL) with the expectations in `PROJECT_CONTEXT.md`:

1. Pull current Prisma schema: `cat prisma/schema.prisma` (or equivalent). Summarize models and fields relevant to:
   - `quran_chapters`, `quran_verses`, `quran_translations`
   - `hadith_collections`, `hadith_books`, `hadith_items`
   - `prayer_times`, `prayer_locations`
   - `gold_prices`
   - `audio_files`, `quran_reciters`
   - `sync_job_logs`, `admin_users`, `admin_audit_logs`

2. For each expected table/field in `PROJECT_CONTEXT.md`, mark:
   - `OK` — exists and matches expectation (list name & type).
   - `MISSING` — missing table/field.
   - `DIFFERENT` — type mismatch or naming difference; show Prisma model and recommended mapping.

3. If there are additional tables not referenced in context, list them and their purpose.

**Deliverable**: a "DB Schema Validation" section in the report showing exact diffs and recommended `prisma` migration changes (with example migration SQL or Prisma change snippet).

---

## Step 3 — Live Data Verification (counts & freshness)
For each module run live queries and report counts and last sync times. Use Prisma or raw SQL:

Example queries (adapt to your schema):
```sql
SELECT COUNT(*) FROM quran_verses;
SELECT COUNT(*) FROM quran_translations WHERE language_code='bn';
SELECT COUNT(*) FROM hadith_items;
SELECT COUNT(*) FROM hadith_items WHERE text_bn IS NOT NULL;
SELECT COUNT(*) FROM prayer_times WHERE date = CURRENT_DATE;
SELECT MAX(last_synced_at) FROM sync_job_logs WHERE module='quran';
SELECT COUNT(*) FROM gold_prices WHERE date >= CURRENT_DATE - INTERVAL '30 days';


For each module provide:

table | current_count | expected_count (if known; e.g. Quran verses ~6236)

last_synced_at timestamp

Translation coverage % for Bangla/English (e.g., hadith text_bn non-null / total)

Flag items as:

OK (counts in expected range and recent sync)

STALE (last_synced older than expected or missing)

UNDERPOPULATED (count far below expected — e.g., hadith translations missing)

ERROR (query failed)

Write SQL / Prisma commands you used and their outputs. Add remediation steps.

Step 4 — OpenAPI / Endpoint Verification (automated)

Fetch OpenAPI JSON: curl -s http://localhost:3000/docs-json > /tmp/openapi.json

Compare the endpoint list in PROJECT_CONTEXT.md with actual paths in openapi.json.paths. For each endpoint listed in the project context:

Verify it exists in OpenAPI.

Verify methods (GET/POST/PUT/DELETE) match.

Retrieve the response schema and example (if any).

For a subset of critical endpoints run live API checks (curl) and validate:

Expected response code (200, 202 for queued jobs).

Response JSON shape includes required fields (e.g., { jobId, status } for sync triggers).

For data read endpoints (Quran surah, Hadith collection, Prayer times), verify the body contains expected language fields (text_ar, text_en, text_bn) where applicable.

Example curl tests (run and capture output):

# swagger
curl -sS http://localhost:3000/docs-json | jq '.paths | keys[]' | sort

# quran surah example
curl -sS "http://localhost:3000/api/v4/quran/surah/1" | jq 'keys'
# hadith collection
curl -sS "http://localhost:3000/api/v4/hadith/collections" | jq '.[0] | keys'
# admin sync trigger
curl -sS -X POST http://localhost:3000/api/v4/admin/sync/quran -H "Content-Type: application/json" -d '{}'


For any endpoint mismatches, missing endpoints, or schema differences:

Record them in PROJECT_STATUS.md as tasks.

Provide precise file paths to controllers or routes that should be changed.

Provide example fix snippets or mapping code to align upstream-compatible shapes.

Acceptance rule: Public endpoints used by mobile app must provide upstream-compatible JSON shapes per PROJECT_CONTEXT.md. If not, classify as P0.

Step 5 — Sync Jobs, Cron & Workers Verification

Check that ScheduleModule and SyncModule are enabled in src/app.module.ts.

List cron jobs and their cron expressions by scanning src/sync/ or src/scheduler/ files (print code).

Manually trigger each sync endpoint (admin triggers) and observe worker behavior:

Does the job get queued (BullMQ)? Check Redis queue.

Does a background worker process pick it up? Check worker logs.

Does sync_job_logs get in_progress then success/failed updates?

If jobs are not processed:

Check worker startup (is there a separate process required, npm run worker?).

Check Redis connection or queue naming mismatch.

Add remediation steps and test commands. If cron entries are missing or commented out, create a P0 task to enable them.

Step 6 — Data Consistency & Fallback Behavior

Validate fallback logic for read endpoints:

If DB entry missing, does API fetch from upstream (e.g., Quran.com / Aladhan) and return it?

Simulate missing DB row for a surah or prayer and document actual behavior.

Check idempotency of sync jobs: running the same sync twice should not create duplicates — run a sync twice and check counts before/after.

If fallback or idempotency is broken, record a P0/P1 item and recommended code fix.

Step 7 — Security & Auth Checks

Admin endpoints must be JWT-protected. Try calling an admin endpoint without token and ensure 401.

Check /admin/auth/login flow and refresh token support; test login with seeded admin user or via scripts/seed-admin-user.ts.

Confirm secrets are not committed (.env not in repo). If secrets exist, list file paths and mark as SECURITY-VULN.

Verify rate limiting & CORS configured.

Record any security gaps and add tasks to PROJECT_STATUS.md. If critical (exposed secrets or unprotected admin endpoints), mark P0.

Step 8 — Tests & CI

Run tests: npm test and npm run test:coverage if available. Record coverage numbers.

Identify high-risk areas with no tests (e.g., sync services, DB upsert logic, admin auth).

Propose specific unit/integration tests to add (list files & test descriptions) and add them to PROJECT_STATUS.md.

Step 9 — Documentation Reconciliation

Compare actual repo state with PROJECT_CONTEXT.md and PROJECT_STATUS.md.

For each mismatch (architecture claim vs reality), update PROJECT_CONTEXT.md:

If new modules exist, add them.

If assumptions were wrong (e.g., queue = BullMQ but code uses custom queue), update wording.

For every error/bug found, add an entry to PROJECT_STATUS.md with:

ID (e.g., TASK-###)

Title

Module

Priority (P0/P1/P2)

Assignee suggestion: Backend, DevOps, QA

Estimate (hours)

Depends on

Status (In Progress, Pending, Blocked)

Short reproducible steps & logs.

Important: Provide a PR-ready patch for documentation updates (diff or full updated markdown files)

Step 10 — Deliverables & Output files

Create these files in the repo (or show content to paste):

reports/full-deep-analysis.md — Complete analysis with all logs, queries, curl outputs, and prioritized issue list.

scripts/check-backend-health.sh — shell script to run environment checks (build, DB, redis, swagger, critical endpoints).

scripts/check-db-counts.js — Node/Prisma script that prints counts & coverage percentages for translation columns.

Update PROJECT_STATUS.md — insert new tasks and mark items with links to code references.

Update PROJECT_CONTEXT.md if necessary — include a brief "Changes since last version" section with exact diffs.

Open branches & PRs for doc changes and any immediate small fixes (e.g., comment/uncomment SyncModule) — one PR per fix.

Prioritization guidance (use these labels)

P0 — Blocks publishing / security-critical / causes data loss (fix immediately)

P1 — Major feature missing or broken (fix in sprint)

P2 — Improvements, tests, docs (schedule)

Acceptance Criteria (how you know analysis is successful)

reports/full-deep-analysis.md exists and includes:

Environment status, DB schema diffs, API verification table, live SQL outputs, sync job checks, security checks.

PROJECT_STATUS.md updated with accurate tasks for all discovered issues (no more than 24 hrs of P0 backlog).

If any changes to PROJECT_CONTEXT.md are required, a clear updated draft is committed to a branch and PR created.

Health-check scripts created so CI can run these checks nightly.

Misc / Implementation notes for Cursor

Be precise: when you reference code lines or files include exact file path and code snippet.

When you propose code fixes, include minimal focused diffs (e.g., @@ -x,y +x,y) and the rationale.

Do not modify production secrets or commit secrets.

validate API compatibility rather than changing API shapes unless absolutely necessary and documented.