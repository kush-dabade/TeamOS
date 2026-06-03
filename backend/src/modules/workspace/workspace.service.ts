import { prisma } from "../../lib/prisma.js";
import { generateSlug } from "../../lib/slug.js";

import type { CreateWorkspaceData } from "./workspace.types.js";

async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = generateSlug(name);

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existingWorkspace = await prisma.workspace.findUnique({
      where: {
        slug,
      },
    });

    if (!existingWorkspace) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function createWorkspace(data: CreateWorkspaceData) {
  const slug = await generateUniqueSlug(data.name);

  const workspace = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: data.name,
        slug,
        ownerId: data.ownerId,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: data.ownerId,
        role: "OWNER",
      },
    });

    return workspace;
  });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt,
  };
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
    },
    include: {
      workspace: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return memberships.map((membership) => ({
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    role: membership.role,
    createdAt: membership.workspace.createdAt,
  }));
}
