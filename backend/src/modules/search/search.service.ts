import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

import { requireWorkspaceMembership } from "../../shared/authorization/workspace-access.js";

import type {
  SearchProjectResult,
  SearchTaskResult,
  SearchResponse,
} from "./search.types.js";
import type { SearchQuery } from "./search.schema.js";

interface SearchProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface SearchTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: SearchTaskResult["status"];
  priority: SearchTaskResult["priority"];
  projectId: string;
}

// The single implementation of prefix search, shared by searchProjects and
// searchTasks. Builds an AND-of-prefixes tsquery straight from the
// tokenized input - deliberately not from websearch_to_tsquery. This is a
// command palette, not a full search language, so quoted phrases, OR, and
// "-" exclusion aren't preserved: every word the user types (including
// ones they've already finished typing) becomes a prefix match, ANDed
// together.
//
// This was previously built on top of websearch_to_tsquery's ::text
// serialization, round-tripped back through to_tsquery to append a prefix
// marker to the final lexeme. That round-trip turned out to be lossy for
// hyphenated/compound words (e.g. "Sprint-task") - websearch_to_tsquery's
// internal representation for those doesn't survive a text round-trip,
// silently corrupting the query and making real, exactly-typed titles
// unsearchable. Building directly from tsvector_to_array sidesteps that
// entirely: there's no tsquery -> text -> tsquery round-trip anywhere in
// this construction.
//
// Why malformed input can't produce invalid tsquery syntax: unnest(
// tsvector_to_array(to_tsvector('simple', ...))) can only ever yield
// plain, already-sanitized lexemes - to_tsvector silently discards
// anything that isn't a word character, so the raw query string never
// reaches to_tsquery directly. If the input tokenizes to nothing (e.g.
// pure punctuation), string_agg returns NULL, to_tsquery('simple', NULL)
// returns NULL, and the @@ comparison below simply matches no rows
// instead of erroring.
function buildPrefixSearchCte(query: string): Prisma.Sql {
  return Prisma.sql`
WITH search_query AS (
  SELECT to_tsquery(
    'simple',
    string_agg(lexeme || ':*', ' & ')
  ) AS tsquery
  FROM unnest(tsvector_to_array(to_tsvector('simple', ${query}))) AS lexeme
)
`;
}

async function searchProjects(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<SearchProjectResult[]> {
  return prisma.$queryRaw<SearchProjectRow[]>(Prisma.sql`
${buildPrefixSearchCte(query)}
SELECT
  id,
  slug,
  name,
  description
FROM "Project", search_query
WHERE
  "workspaceId" = ${workspaceId}
  AND "status" <> 'ARCHIVED'
  AND to_tsvector(
    'simple',
    "name" || ' ' || coalesce("description", '')
  ) @@ search_query.tsquery
ORDER BY
  ts_rank(
    to_tsvector(
      'simple',
      "name" || ' ' || coalesce("description", '')
    ),
    search_query.tsquery
  ) DESC,
  "createdAt" DESC
LIMIT ${limit};
  `);
}

async function searchTasks(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<SearchTaskResult[]> {
  return prisma.$queryRaw<SearchTaskRow[]>(Prisma.sql`
${buildPrefixSearchCte(query)}
SELECT
  id,
  title,
  description,
  status,
  priority,
  "projectId"
FROM "Task", search_query
WHERE
  "workspaceId" = ${workspaceId}
  AND "deletedAt" IS NULL
  AND to_tsvector(
    'simple',
    "title" || ' ' || coalesce("description", '')
  ) @@ search_query.tsquery
ORDER BY
  ts_rank(
    to_tsvector(
      'simple',
      "title" || ' ' || coalesce("description", '')
    ),
    search_query.tsquery
  ) DESC,
  "createdAt" DESC
LIMIT ${limit};
  `);
}

export async function search(
  actorId: string,
  query: SearchQuery,
): Promise<SearchResponse> {
  await requireWorkspaceMembership(query.workspaceId, actorId);

  const [projects, tasks] = await Promise.all([
    searchProjects(query.workspaceId, query.q, query.limit),
    searchTasks(query.workspaceId, query.q, query.limit),
  ]);

  return {
    query: query.q,
    projects,
    tasks,
  };
}
