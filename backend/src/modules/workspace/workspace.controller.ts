import type { Request, Response } from "express";

import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  updateWorkspaceMemberRoleSchema,
  transferWorkspaceOwnershipSchema,
} from "./workspace.schema.js";
import {
  createWorkspace,
  getUserWorkspaces,
  getWorkspace,
  updateWorkspace,
  listWorkspaceMembers,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  leaveWorkspace,
  transferWorkspaceOwnership,
} from "./workspace.service.js";

export async function createWorkspaceHandler(req: Request, res: Response) {
  const body = createWorkspaceSchema.parse(req.body);

  const workspace = await createWorkspace({
    name: body.name,
    ownerId: req.user!.id,
  });

  return res.status(201).json({
    success: true,
    data: workspace,
  });
}

export async function getUserWorkspacesHandler(req: Request, res: Response) {
  const workspaces = await getUserWorkspaces(req.user!.id);

  return res.status(200).json({
    success: true,
    data: workspaces,
  });
}

export async function getWorkspaceHandler(req: Request, res: Response) {
  const workspace = await getWorkspace(
    req.params.workspaceId as string,
    req.user!.id,
  );

  return res.status(200).json({
    success: true,
    data: workspace,
  });
}

export async function updateWorkspaceHandler(req: Request, res: Response) {
  const body = updateWorkspaceSchema.parse(req.body);

  const workspace = await updateWorkspace(
    req.user!.id,
    req.params.workspaceId as string,
    body,
  );

  return res.status(200).json({
    success: true,
    data: workspace,
  });
}

export async function listWorkspaceMembersHandler(req: Request, res: Response) {
  const members = await listWorkspaceMembers(
    req.params.workspaceId as string,
    req.user!.id,
  );

  return res.status(200).json({
    success: true,
    data: members,
  });
}

export async function updateWorkspaceMemberRoleHandler(
  req: Request,
  res: Response,
) {
  const body = updateWorkspaceMemberRoleSchema.parse(req.body);

  const member = await updateWorkspaceMemberRole(
    req.user!.id,
    req.params.workspaceId as string,
    req.params.memberId as string,
    body.role,
  );

  return res.status(200).json({
    success: true,
    data: member,
  });
}

export async function removeWorkspaceMemberHandler(
  req: Request,
  res: Response,
) {
  const result = await removeWorkspaceMember(
    req.user!.id,
    req.params.workspaceId as string,
    req.params.memberId as string,
  );

  return res.status(200).json(result);
}

export async function transferWorkspaceOwnershipHandler(
  req: Request,
  res: Response,
) {
  const body = transferWorkspaceOwnershipSchema.parse(req.body);

  const result = await transferWorkspaceOwnership(
    req.user!.id,
    req.params.workspaceId as string,
    body.memberId,
  );

  return res.status(200).json({
    success: true,
    data: result,
  });
}

export async function leaveWorkspaceHandler(req: Request, res: Response) {
  const result = await leaveWorkspace(
    req.user!.id,
    req.params.workspaceId as string,
  );

  return res.status(200).json(result);
}
