# Testing

TeamOS's test suite is built around real integration behavior — real HTTP requests against the real Express app, a real PostgreSQL database, and a real Redis instance — not mocked-out unit tests of individual functions. This is a deliberate choice given the project's actual risk surface: multi-tenant isolation, RBAC, and realtime/queue behavior are all cross-cutting concerns that a function-level unit test can't meaningfully verify. Frontend tests are narrower and component/hook-scoped, using mocked network calls.

## Backend tests

**Vitest** (`backend/vitest.config.ts`), run via:
```bash
cd backend
npm test          # vitest run
```

- **Environment**: `node` (not jsdom — these are server-side HTTP tests).
- **Global setup** (`tests/global-setup.ts`): runs `npx prisma migrate deploy` once, before any test file starts, against whatever `DATABASE_URL` resolves to (see below) — never against your real development database, by construction.
- **Per-worker setup** (`vitest.config.ts`'s `setupFiles`): `tests/setup/test-env.ts` (loads and validates the test database URL) and `tests/setup/rate-limit-cleanup-hook.ts` (a global `afterEach` that clears Redis-backed rate-limit counters so one test's rate-limiting doesn't bleed into the next).
- **Test isolation**: `fileParallelism: false` — test files run sequentially, not in parallel, specifically because they share one `teamos_test` database with `TRUNCATE`-based cleanup between tests; running them concurrently would let files race and clobber each other's state.
- **`testTimeout: 15000`** (15s) — these are real network/database round trips, not pure unit tests, so the default 5s is too tight.
- **HTTP layer**: `supertest` against the real Express `app` export — requests go through the actual middleware chain (auth, rate limiting, validation), not a stubbed router.
- **Auth in tests**: `tests/setup/fixtures.ts`'s `signUpTestUser` goes through the real `/api/auth/sign-up/email` endpoint, then marks the user verified via a direct Prisma write (simulating clicking the verification link) and signs in for a real session cookie — the same cookie authenticates both HTTP (`supertest`) and Socket.IO (`extraHeaders: { Cookie }`) requests in a test, since both paths call the same `auth.api.getSession()`.

What's actually covered, verified by directory (`backend/tests/`, one directory per domain, mirroring `src/modules/`): `activity`, `attachment`, `comments`, `demo`, `health`, `lib`, `middleware`, `notification`, `project`, `queues`, `realtime`, `search`, `security`, `sprint`, `task`, `user`, `workspace` — 69 test files total. By area:
- **Authentication/authorization/tenant isolation**: `tests/security/` — `tenant-isolation.test.ts`, `rbac.test.ts`, `session-cookie.test.ts`, `email-verification.test.ts`, `password-reset.test.ts`, `auth-rate-limit.test.ts`, `auth-account-rate-limit.test.ts`, `unauthenticated-access.test.ts`, `trust-proxy-hops.test.ts`, `security-headers.test.ts`, `dev-verification-bypass.test.ts`, `node-env-fail-closed.test.ts`, plus a dedicated `user/user-avatar.test.ts` covering the avatar-IDOR closure.
- **Core domain CRUD/workflows**: `project/`, `task/`, `sprint/`, `comments/`, `attachment/`, `workspace/` — including cross-workspace-access assertions in `task/task-crud.test.ts`, `project/project-crud.test.ts`, `sprint/sprint-crud.test.ts`, and others.
- **Concurrency/invariants**: sprint active-sprint-conflict behavior is exercised alongside the CRUD tests above.
- **Background jobs**: `tests/queues/` — `deterministic-job-ids.test.ts`, `failed-job-retention.test.ts`, `redis-db-isolation.test.ts`, `email-worker-dispatch.test.ts`, `notification-worker-dispatch.test.ts`.
- **Search**: `tests/search/`.
- **Realtime**: `tests/realtime/` — `workspace-room-isolation.test.ts`, `session-revocation.test.ts`, `task-events.test.ts`, `eviction-resilience.test.ts`.
- **Demo provisioning**: `tests/demo/`.

This list reflects what actually has a test file today — it is not a claim that every behavior in every module is covered.

## Frontend tests

**Vitest** + **`@testing-library/react`** + **`jsdom`** + **`@testing-library/jest-dom`** (`frontend/vitest.config.ts`, which extends the app's own `vite.config.ts` so tests resolve imports — including the `@/*` alias — exactly like the app does), run via:
```bash
cd frontend
npm run test       # vitest run
```
Setup file (`src/test/setup.ts`) only imports `@testing-library/jest-dom/vitest` for the extended DOM matchers. `src/test/create-test-query-client.ts` provides a fresh, retry-disabled `QueryClient` per test so hook tests don't leak cached state or retry against a mocked API.

Coverage is narrower than the backend's, and this document does not claim otherwise: 25 test files, a mix of component tests (`TaskForm`, `ProjectForm`, `SprintForm`, `CommentForm`, `ProjectPreviewPanel`, `ProjectHeader`, `ProjectWorkspacePage`, route guards, the demo indicator/`TryPage`) and hook tests (task/project/comment mutations, workspace member removal, recent-activity, demo session creation, realtime event handlers). This is targeted coverage of specific components/hooks with real regression history (e.g. the archived-project guard, sprint cache invalidation), not comprehensive UI coverage.

## End-to-end tests

**Playwright** (`frontend/playwright.config.ts`, specs in `frontend/e2e/`) drives a real Chromium against a **local stack only**. On every run, `e2e/start-backend.mjs` does the following:

1. Recreates a dedicated `teamos_e2e` database and applies migrations.
2. Flushes Redis logical DB 2 (the backend integration tests use DB 1).
3. Points uploads at a temp directory.
4. Starts the API on `:3100` with `NODE_ENV=test`.

Playwright also starts Vite on `:5174`. The script refuses a non-localhost database, and nothing in the suite talks to production.

The prerequisites are the same local Postgres and password-protected Redis the backend tests use (`backend/.env.test`), plus a browser:

```bash
cd frontend
npx playwright install chromium   # once
npm run test:e2e                   # playwright test
```

**Email in E2E.** No email worker runs, so verification and password-reset emails stay queued in Redis. The specs read the exact link from the queued job (`readEmailLink` in `e2e/support.ts`). Verification is still required and exercised end to end; it just isn't delivered through Resend. That's also why this suite can't prove real delivery. The manual smoke test in [`deployment.md`](./deployment.md#post-change-delivery-smoke-test) does that.

| Spec | Covers |
|---|---|
| `public.spec.ts` | Landing page, route guards, 404 |
| `auth.spec.ts` | Register → unverified login refused → verify → login → onboarding → session survives reload → sign out; server-side password policy; forgot/reset password |
| `workflow.spec.ts` | Project create/edit, task create/update/delete, URL filters and list delete, comment, attachment upload/download/delete and signature rejection, sprint lifecycle, search |
| `isolation.spec.ts` | Another tenant can't open or read a workspace's project (UI and API) |
| `realtime.spec.ts` | A task created in one tab appears in another tab's `/tasks` without a reload |

Specs run serially in one worker, because they share sign-up/sign-in rate limits and the database. A failure keeps a trace and screenshot in `frontend/test-results/` (gitignored).

The suite isn't part of CI yet. It needs Postgres and Redis service containers plus a browser install in the frontend workflow, and that configuration should only be added once it has been proven on a real Actions run.

## Type checking

```bash
cd backend && npx tsc --noEmit -p tsconfig.test.json   # covers src/ and tests/
cd frontend && npx tsc -b                               # app, Vite config and e2e/; also part of `npm run build`
```

## CI

Three GitHub Actions workflows (`.github/workflows/`) run on every pull request and are required checks on `main`. On a push to `main`, `release.yml` calls the same three again on the merge commit before it publishes and deploys anything (see [`deployment.md` § Releases](./deployment.md#releases)).

**`backend-ci.yml`**: Node 22, disposable `postgres:17` and `redis:8-alpine` service containers (the CI Redis runs without a password — GitHub Actions service containers can't be given startup arguments like `--requirepass`; `REDIS_PASSWORD` is still set to a non-empty dummy value because the app's own config requires one, and `ioredis` connects fine against an unauthenticated server). Steps: checkout → Node 22 setup (with npm cache) → `npm ci` → `npx prisma generate` → `npx prisma migrate deploy` → `npm run lint` → `npx tsc --noEmit -p tsconfig.test.json` → `npm test`.

**`frontend-ci.yml`**: Node 22. Steps: checkout → Node 22 setup → `npm ci` → `npm run lint` → `npm run test` → `npm run build` (which is both the typecheck, via its `tsc -b` phase, and the production build — there's no separate frontend typecheck script).

**`production-ci.yml`**, two jobs:

- **Production images**: builds `backend/Dockerfile` and `frontend/Dockerfile` exactly as the release does, validates `docker-compose.prod.yml`, and starts the real production stack on the runner with generated throwaway credentials and `PUBLIC_ORIGIN=https://localhost` (Caddy's internal CA). It then runs `scripts/ops/deploy.sh --verify` — the health gate a production deployment uses: `migrate` exited 0, every service healthy on the freshly built images, and `/ready`, `/health` (reporting this commit's revision) and the SPA answering through Caddy. This is the only check that exercises the compiled server and worker, the Prisma runtime config inside the image, and Caddy's routing.
- **Deploy tooling**: shellcheck over `scripts/ops/*.sh`, actionlint (checksum-pinned download) over the workflows, `scripts/ci/check-workflows.py` plus its unit tests (pull-request workflows can't publish or deploy; least-privilege permissions; SHA-pinned actions), and `scripts/ops/check-migrations.sh` over migrations the pull request adds (merged migrations may not be edited).

Every workflow declares its own permissions — `contents: read` for all of the above — and uses throwaway/dummy environment values (`BETTER_AUTH_SECRET`, `RESEND_API_KEY`, etc.), never real secrets.

**Deployment scripts** are tested in Backend CI like the other ops scripts: `tests/ops/deploy.test.ts` runs `deploy.sh`, `run-deploy.sh` and `check-migrations.sh` against a real git repository and a fake host (`tests/ops/support/fake-host.mjs` stands in for docker/compose, curl, psql and sudo). It covers SHA validation, the deployment lock, stale-release rejection, provenance checks, health-gate failure and rollback, migration failure and contract migrations (no rollback), retention, and that no secret reaches the output. Locally: `cd backend && npx vitest run tests/ops/deploy.test.ts` (needs `git`, `flock` and `bash`); `python3 -m unittest discover -s scripts/ci -p 'test_*.py'` for the workflow policy.

## Test database

Backend tests never touch your development database. `tests/setup/test-env.ts` resolves `DATABASE_URL` from `backend/.env.test` (copied from `.env.test.example`) if present, or from a `TEST_DATABASE_URL` environment variable (what CI uses) — and **deliberately ignores any `DATABASE_URL` already set in the process environment**, specifically so a stray pre-existing value can never point the test run at a real database. If neither is available, the harness throws rather than guessing.

Between tests, `tests/setup/reset-database.ts`'s `resetDatabase()` runs `TRUNCATE TABLE ... CASCADE` across every application table. Before doing so, it independently re-parses the database name out of `DATABASE_URL` and refuses to proceed unless it is exactly `teamos_test` — a safety check against ever truncating the real development database, re-checked on every call rather than cached once.

Redis is also isolated, not just Postgres: `backend/.env.test.example` sets `REDIS_DB=1` so test-created BullMQ jobs and rate-limit counters land on a separate logical Redis database from the one your local dev worker (`REDIS_DB` unset, defaults to `0`) reads from — tests can enqueue real jobs (e.g. every sign-up enqueues a verification-email job) without a real `npm run worker` process ever picking them up.

One-time local setup, beyond copying `.env.test.example`:
```bash
docker compose exec postgres createdb -U postgres teamos_test
```

## Writing new tests

- **Backend tests** live under `backend/tests/<domain>/`, mirroring the `backend/src/modules/<domain>/` the code under test belongs to (e.g. a new sprint behavior test belongs in `tests/sprint/`, not inside `src/`).
- **Frontend tests** live alongside the component/hook they test (`ComponentName.test.tsx` / `use-thing.test.ts`, colocated in the same feature folder) — not in a separate top-level test tree.
- **Fixtures**: reuse `tests/setup/fixtures.ts` (`signUpTestUser`, workspace/membership helpers) rather than hand-rolling authentication or workspace setup in a new test file.
- **Isolation**: a test file that mutates the database should call `resetDatabase()` (typically in `afterEach`) — see any existing file under `tests/attachment/` or `tests/workspace/` for the pattern.
- **Focused runs**: `npx vitest run <path-or-pattern>` from `backend/` or `frontend/` runs a subset — plain Vitest, no custom wrapper script.

## What should be tested

Prioritize, consistent with what the existing suite already emphasizes: tenant isolation (a request against a resource in a workspace the caller isn't a member of must fail); role/authorization boundaries (`OWNER`/`ADMIN`-gated actions actually rejecting `MEMBER`/`GUEST`); data-integrity invariants enforced at the database level (e.g. the one-active-sprint-per-project partial unique index — see [`../architecture/database-design.md` §6](../architecture/database-design.md#6-constraints-and-invariants)); input validation; realtime room isolation and session-revocation eviction; and queue behavior (deterministic job IDs, retry/retention). Avoid writing tests that only exercise a happy path already covered elsewhere without adding a genuinely new failure mode.

## Cross-reference

[`../architecture/system-design.md`](../architecture/system-design.md) for the request lifecycle and realtime/queue architecture these tests exercise; [`../architecture/database-design.md`](../architecture/database-design.md) for the constraints referenced above; the relevant `../features/*.md` doc for behavior specific to one feature.
