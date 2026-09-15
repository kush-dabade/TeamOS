# Local Development

A practical guide to running TeamOS from a fresh clone. For how the system is built, see [`../architecture/system-design.md`](../architecture/system-design.md) and [`../architecture/database-design.md`](../architecture/database-design.md) — this document is about running it, not designing it.

## Prerequisites

- **Docker and Docker Compose** — required. PostgreSQL and Redis are only run as containers (`docker-compose.yml`); there is no documented native-install path for either.
- **Node.js** — required for the frontend (which always runs on the host, never in Docker) and for the backend/worker if you run them directly on the host instead of inside Docker. CI (`.github/workflows/*.yml`) and the backend `Dockerfile` both pin **Node 22**; use that.
- **Git**.
- No WSL2 requirement is established anywhere in the repository — nothing in the Dockerfiles, Compose file, or CI assumes a specific host OS.

PostgreSQL and Redis themselves are **not** host prerequisites — Docker provides both; you don't need them installed locally.

## Repository structure

```text
backend/    Express API + BullMQ worker (one codebase, two entrypoints — see below)
  prisma/   schema.prisma, migrations/, seed.ts
  src/      modules/, realtime/, queues/, storage/, lib/
  tests/    Vitest integration tests (real HTTP/Postgres/Redis)
frontend/   React + Vite SPA
docs/       this documentation set
```

Prisma's schema lives at `backend/prisma/schema.prisma`; migrations at `backend/prisma/migrations/`. The generated Prisma Client (`backend/src/generated/prisma`) is gitignored and does not exist until you run `npx prisma generate` — `npm install` does not build it for you.

## Environment configuration

Three separate env files, each copied from its own `.example`, none committed:

| File | Copied from | Consumed by |
|---|---|---|
| `.env` (repo root) | `.env.example` | Docker Compose itself (`POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`) |
| `backend/.env` | `backend/.env.example` | The backend application process (API and worker) |
| `frontend/.env` | `frontend/.env.example` | Vite (`VITE_API_URL`) — the frontend throws at startup without it |

Both root `.env` and `backend/.env` ship with working local-development defaults (`localhost` URLs, matching Postgres/Redis credentials) — these are local-only placeholders, never production values. **One value has no safe default**: `BETTER_AUTH_SECRET` in `backend/.env` (the session-signing secret) must be generated yourself:

```bash
openssl rand -base64 32
```

`RESEND_API_KEY`/`EMAIL_FROM` in `backend/.env` can stay blank for local development — see [Common development notes](#common-development-notes).

## Starting infrastructure

```bash
# terminal 1 — infrastructure
docker compose up postgres redis migrate
```

This starts the `postgres` (17) and `redis` (8-alpine) containers and runs the one-shot `migrate` service (`npx prisma migrate deploy`) against them once both are healthy, then exits. Ports are published to `127.0.0.1` only: Postgres on `5432`, Redis on `6379` (password-protected, from `REDIS_PASSWORD`). Named volumes (`postgres-data`, `redis-data`, `uploads-data`) persist data across restarts.

If you'd rather run the backend and worker in Docker too (matching the repository's own README shortcut) instead of on the host as described below, `docker compose up --build` alone starts everything — Postgres, Redis, migrations, the API on port `3000`, and the worker.

## Backend setup

```bash
cd backend
npm install
npx prisma generate    # builds the gitignored Prisma Client — required before anything else runs
npm run seed            # optional: populates the permanent local "Acme Inc." demo workspace
```

The seed is idempotent (every entity is looked up before it's created) — safe to run more than once, though reruns don't retroactively fix rows an older version of the seed already created.

**The API and the BullMQ worker are two separate runtime processes started from the same codebase** — not two separate applications, not a microservice split, just two entrypoints (`src/server.ts`, `src/worker.ts`) into one modular monolith, sharing the same Prisma client, Redis connection, and modules. Both must be running for the app to fully work (job-backed features — notification creation, email — depend on the worker; see [`../architecture/system-design.md` §11](../architecture/system-design.md#11-background-jobs)).

```bash
# terminal 2 — backend API
cd backend
npm run dev       # tsx watch src/server.ts, listens on :3000

# terminal 3 — background worker
cd backend
npm run worker    # tsx watch src/worker.ts
```

## Frontend setup

```bash
# terminal 4 — frontend
cd frontend
npm install
npm run dev       # vite, listens on :5173 by default
```

The frontend's only required environment variable is `VITE_API_URL` (`frontend/.env`, default `http://localhost:3000`) — the backend's own address. There is no other frontend-specific local setup.

## Running TeamOS

Four terminals, in order: infrastructure → backend API → worker → frontend (as above). Once all four are up, sign in at the frontend's URL either with the seeded demo account (`demo@teamos.local` / `TeamOSDemo123!` — a local-only, publicly-documented password; never reuse it or point the seed at anything but a local database) or by registering a new account, or use the app's own `/try` button, which provisions a disposable copy of the same demo content for an anonymous visitor with no setup at all (see [`../features/demo.md`](../features/demo.md)).

## Database workflow

- **Migrations (development)**: `npx prisma migrate dev` from `backend/` — generates and applies a new migration against your local database. `npx prisma migrate deploy` (what `docker compose up`'s `migrate` service runs, and what CI runs) only applies already-generated migrations; it never generates new ones.
- **Client generation**: `npx prisma generate` after pulling schema changes, or on a fresh clone — nothing else triggers it.
- **Seeding**: `npm run seed` (`NODE_ENV=development tsx prisma/seed.ts`) — idempotent, as above.
- **No reset command is part of the documented workflow.** There is no `prisma migrate reset` step in the README, Docker setup, or CI — do not reset your local database as a routine operation; it isn't an intentional part of this project's development flow (the closest thing, `resetDatabase()`'s `TRUNCATE`, exists only for the *test* database — see [`testing.md`](./testing.md)).

## Common development notes

- **Email verification is bypassed in local development only**: a `NODE_ENV === "development"` check (not `test`, not unset) auto-verifies every new sign-up and skips sending the verification email, so sign-up/sign-in work immediately without a Resend account. Production always runs the real flow, and the test suite exercises that real flow too — this bypass cannot activate in either. See [`../features/authentication.md`](../features/authentication.md).
- **`RESEND_API_KEY`/`EMAIL_FROM` left blank**: the worker still starts and stays healthy; it just logs that it's skipping the send instead of calling Resend. This only affects workspace-invitation and password-reset email, not sign-up.
- **Local file storage**: attachments/avatars are written to a local directory (the `uploads-data` Docker volume when running in Compose) — there is no S3 integration to configure; S3 remains an intentionally unimplemented stub (see [`../features/attachments.md`](../features/attachments.md)).
- **Ports**: backend API `3000`, frontend `5173`, Postgres `5432`, Redis `6379` — all on `localhost` by default, matching the `.env.example` files.
- **Socket.IO** runs on the same HTTP server as the API (port `3000`) — there is no separate realtime port to configure.

## Architecture cross-reference

For how these pieces fit together (multi-tenancy, realtime, background jobs, request lifecycle), see [`../architecture/system-design.md`](../architecture/system-design.md); for the schema itself, see [`../architecture/database-design.md`](../architecture/database-design.md).
