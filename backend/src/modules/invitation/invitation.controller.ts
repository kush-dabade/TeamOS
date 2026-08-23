import type { Request, Response } from "express";

import {
  createInvitationSchema,
  invitationTokenParamSchema,
} from "./invitation.schema.js";

import {
  createInvitation,
  listWorkspaceInvitations,
  listUserInvitations,
  getInvitationPreview,
  acceptInvitation,
  acceptInvitationByToken,
  declineInvitation,
  declineInvitationByToken,
  cancelInvitation,
  resendInvitation,
} from "./invitation.service.js";

export async function createInvitationHandler(req: Request, res: Response) {
  const body = createInvitationSchema.parse(req.body);

  const invitation = await createInvitation({
    workspaceId: req.params.workspaceId as string,

    email: body.email,
    role: body.role,

    invitedById: req.user!.id,
  });

  return res.status(201).json({
    success: true,
    data: invitation,
  });
}

export async function listWorkspaceInvitationsHandler(
  req: Request,
  res: Response,
) {
  const invitations = await listWorkspaceInvitations(
    req.params.workspaceId as string,
    req.user!.id,
  );

  return res.status(200).json({
    success: true,
    data: invitations,
  });
}

export async function cancelInvitationHandler(req: Request, res: Response) {
  await cancelInvitation(
    req.user!.id,
    req.params.workspaceId as string,
    req.params.invitationId as string,
  );

  return res.status(200).json({
    success: true,
    data: null,
  });
}

export async function resendInvitationHandler(req: Request, res: Response) {
  const invitation = await resendInvitation(
    req.user!.id,
    req.params.workspaceId as string,
    req.params.invitationId as string,
  );

  return res.status(200).json({
    success: true,
    data: invitation,
  });
}

export async function listUserInvitationsHandler(req: Request, res: Response) {
  const invitations = await listUserInvitations(req.user!.email);

  return res.status(200).json({
    success: true,
    data: invitations,
  });
}

export async function getInvitationPreviewHandler(
  req: Request,
  res: Response,
) {
  const params = invitationTokenParamSchema.parse(req.params);

  const preview = await getInvitationPreview(params.token);

  return res.status(200).json({
    success: true,
    data: preview,
  });
}

export async function acceptInvitationHandler(
  req: Request,
  res: Response,
) {
  const invitation = await acceptInvitation(
    req.params.invitationId as string,
    req.user!.id,
    req.user!.email,
  );

  return res.status(200).json({
    success: true,
    data: invitation,
  });
}

export async function acceptInvitationByTokenHandler(
  req: Request,
  res: Response,
) {
  const params = invitationTokenParamSchema.parse(req.params);

  const invitation = await acceptInvitationByToken(
    params.token,
    req.user!.id,
    req.user!.email,
  );

  return res.status(200).json({
    success: true,
    data: invitation,
  });
}

export async function declineInvitationHandler(
  req: Request,
  res: Response,
) {
  const invitation = await declineInvitation(
    req.params.invitationId as string,
    req.user!.id,
    req.user!.email,
  );

  return res.status(200).json({
    success: true,
    data: invitation,
  });
}

export async function declineInvitationByTokenHandler(
  req: Request,
  res: Response,
) {
  const params = invitationTokenParamSchema.parse(req.params);

  const invitation = await declineInvitationByToken(
    params.token,
    req.user!.id,
    req.user!.email,
  );

  return res.status(200).json({
    success: true,
    data: invitation,
  });
}
