import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";

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

async function searchProjects(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<SearchProjectResult[]> {
  return prisma.$queryRaw<SearchProjectRow[]>(Prisma.sql`
SELECT
  id,
  slug,
  name,
  description
FROM "Project"
WHERE
  "workspaceId" = ${workspaceId}
  AND "status" <> 'ARCHIVED'
  AND to_tsvector(
    'simple',
    "name" || ' ' || coalesce("description", '')
  ) @@ websearch_to_tsquery('simple', ${query})
ORDER BY
  ts_rank(
    to_tsvector(
      'simple',
      "name" || ' ' || coalesce("description", '')
    ),
    websearch_to_tsquery('simple', ${query})
  ) DESC,
  "createdAt" DESC
LIMIT ${limit};
  `);
}

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  return membership;
}

async function searchTasks(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<SearchTaskResult[]> {
  return prisma.$queryRaw<SearchTaskRow[]>(Prisma.sql`
SELECT
  id,
  title,
  description,
  status,
  priority,
  "projectId"
FROM "Task"
WHERE
  "workspaceId" = ${workspaceId}
  AND "deletedAt" IS NULL
  AND to_tsvector(
    'simple',
    "title" || ' ' || coalesce("description", '')
  ) @@ websearch_to_tsquery('simple', ${query})
ORDER BY
  ts_rank(
    to_tsvector(
      'simple',
      "title" || ' ' || coalesce("description", '')
    ),
    websearch_to_tsquery('simple', ${query})
  ) DESC,
  "createdAt" DESC
LIMIT ${limit};
  `);
}

export async function search(
  actorId: string,
  query: SearchQuery,
): Promise<SearchResponse> {
  await getWorkspaceMembership(query.workspaceId, actorId);

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
