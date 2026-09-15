# Search

## Scope

Search is scoped to exactly one workspace per request and covers four entity types: **projects**, **tasks**, **sprints**, and **workspace members**. There is no cross-workspace search and no search over comments, attachments, notifications, or activity.

This is genuine PostgreSQL full-text search (`to_tsvector`/`to_tsquery`), not a `LIKE`/`ILIKE` substring filter — `search.service.ts` builds an AND-of-prefixes `tsquery` from the tokenized input (every word the caller has typed, including a partially-typed final word, becomes a prefix match, ANDed together) and ranks results with `ts_rank`. It is deliberately a command-palette search, not a full search query language: quoted phrases, `OR`, and exclusion (`-term`) are not supported.

- **Projects**: matched on name + description, archived projects excluded.
- **Tasks**: matched on title + description, soft-deleted tasks excluded.
- **Sprints**: matched on name + goal; excluded when their *parent project* is archived (sprints have no archived status of their own).
- **Members**: matched on name + email, queried by joining outward **from** `WorkspaceMember` rather than filtering a global user table — this keeps it structurally a workspace member directory, not a cross-workspace user directory.

## API

`GET /api/v1/search?q=&workspaceId=&limit=`:
- `q` — 2–100 characters, required.
- `workspaceId` — must be a valid id; the caller must be a member of it.
- `limit` — defaults to 10, max 50, applied independently per entity type (i.e. up to `limit` projects *and* up to `limit` tasks, etc., not one shared cap across all four).
- Rate-limited: `searchLimiter`, 20 requests/minute/user — tighter than the general API limit because this is the most database-expensive read path in the API (full-text queries across four tables per request).

Full response shape: [`../architecture/api-specification.md` §4](../architecture/api-specification.md#4-endpoint-reference).

## Authorization

`requireWorkspaceMembership(workspaceId, actorId)` is checked before any of the four queries run — the same tenant-isolation model as everywhere else in the API. A non-member's search request fails before touching any data, regardless of what `q` contains.

## Indexing and performance

Dedicated search-supporting indexes were added specifically for this feature (the `add-search-indexes` and `add-sprint-search-index` migrations — the latter built/rebuilt `CONCURRENTLY` to avoid a long lock on `Sprint`). See [`../architecture/database-design.md` §7](../architecture/database-design.md#7-indexing) for the general indexing rationale; this document does not duplicate the index list.

## Frontend

The primary search surface is a **command palette**, not a dedicated search page — `SearchCommand` (bound to Cmd/Ctrl+K, with a header search button as the discoverable/mobile entry point) opens a dialog backed by `SearchCommandContent`. It is best described as **search-then-navigate**, not a general command/action launcher: selecting a result routes to that project, task, or (for a sprint result) a project page with its Sprints tab pre-selected via router state; selecting a member routes to Workspace Settings, since there is no dedicated per-member page. There are no arbitrary "run a command" actions in it beyond navigating to a selected result.

Fetching goes through TanStack Query (`useSearch`, keyed on `workspaceId` + the trimmed query string) with its own debounce (`useDebouncedValue`) before a request fires — not a raw keystroke-per-request fetch. The dialog is remounted (via a session-id key bump) on every close, which is what guarantees a stale in-flight query/debounce from a previous open can never leak into the next session, rather than relying on manually resetting individual pieces of state.
