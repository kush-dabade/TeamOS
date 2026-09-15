# TeamOS Documentation

This directory is the canonical technical documentation for TeamOS — written directly from the current codebase, kept in sync with it, and intended for a developer or reviewer who wants to understand how the system actually works.

## Architecture

- **[System Design](./architecture/system-design.md)** — the modular-monolith architecture, request lifecycle, authentication/authorization, multi-tenancy, realtime, background jobs, storage, and the frontend's server-state model.
- **[Database Design](./architecture/database-design.md)** — the Prisma schema, entity relationships, and which invariants are database-enforced versus application-enforced.
- **[API Specification](./architecture/api-specification.md)** — the `/api/v1` endpoint surface grouped by domain, response/error conventions, pagination styles, and authorization rules.

## Features

- **[Authentication](./features/authentication.md)** — Better Auth, session cookies, email verification, and the avatar-write protection.
- **[Workspaces](./features/workspaces.md)** — the tenant model, membership, roles, ownership, and removal/leave mechanics.
- **[Projects & Tasks](./features/projects-and-tasks.md)** — the core project-management workflow, task lifecycle, and assignment rules.
- **[Sprints](./features/sprints.md)** — sprint lifecycle and the one-active-sprint-per-project invariant.
- **[Collaboration](./features/collaboration.md)** — comments, the activity feed, and the realtime layer that keeps both live.
- **[Notifications](./features/notifications.md)** — the notification model and its BullMQ-backed, cross-process realtime delivery.
- **[Attachments](./features/attachments.md)** — the upload flow, storage abstraction, and security controls.
- **[Search](./features/search.md)** — the full-text search implementation and command-palette frontend.
- **[Demo](./features/demo.md)** — the public `/try` provisioning flow, isolation, and cleanup.

## Development

- **[Local Development](./development/local-development.md)** — cloning, environment configuration, and running TeamOS locally.
- **[Testing](./development/testing.md)** — the backend/frontend test strategy, CI, and how to add new tests.

## Documentation principles

These documents describe the current implementation, not a roadmap or a historical record. When the code changes in a way that affects something documented here, update the relevant document in the same change — a stale doc is worse than no doc.
