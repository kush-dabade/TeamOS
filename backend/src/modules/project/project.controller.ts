import type { Request, Response } from "express";

import {
  createProjectSchema,
  listProjectsQuerySchema,
  transferProjectOwnershipSchema,
  updateProjectSchema,
} from "./project.schema.js";

import {
  archiveProject,
  createProject,
  listProjects,
  getProject,
  restoreProject,
  transferProjectOwnership,
  updateProject,
} from "./project.service.js";

export async function createProjectHandler(req: Request, res: Response) {
  const body = createProjectSchema.parse(req.body);

  const project = await createProject(req.user!.id, {
    workspaceId: req.params.workspaceId as string,
    ownerId: body.ownerId,
    name: body.name,
    description: body.description,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
  });

  return res.status(201).json({
    success: true,
    data: project,
  });
}

export async function listProjectsHandler(req: Request, res: Response) {
  const query = listProjectsQuerySchema.parse(req.query);

  const projects = await listProjects(req.user!.id, {
    workspaceId: req.params.workspaceId as string,
    status: query.status,
  });

  return res.status(200).json({
    success: true,
    data: projects,
  });
}

export async function getProjectHandler(req: Request, res: Response) {
  const project = await getProject(
    req.user!.id,
    req.params.projectId as string,
  );

  return res.status(200).json({
    success: true,
    data: project,
  });
}

export async function updateProjectHandler(req: Request, res: Response) {
  const body = updateProjectSchema.parse(req.body);

  const project = await updateProject(
    req.user!.id,
    req.params.projectId as string,
    body,
  );

  return res.status(200).json({
    success: true,
    data: project,
  });
}

export async function archiveProjectHandler(req: Request, res: Response) {
  const project = await archiveProject(
    req.user!.id,
    req.params.projectId as string,
  );

  return res.status(200).json({
    success: true,
    data: project,
  });
}

export async function restoreProjectHandler(req: Request, res: Response) {
  const project = await restoreProject(
    req.user!.id,
    req.params.projectId as string,
  );

  return res.status(200).json({
    success: true,
    data: project,
  });
}

export async function transferProjectOwnershipHandler(
  req: Request,
  res: Response,
) {
  const body = transferProjectOwnershipSchema.parse(req.body);

  const project = await transferProjectOwnership(
    req.user!.id,
    req.params.projectId as string,
    body.newOwnerId,
  );

  return res.status(200).json({
    success: true,
    data: project,
  });
}
