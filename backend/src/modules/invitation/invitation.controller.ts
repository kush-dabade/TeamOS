import type { Request, Response } from "express";
import { ZodError } from "zod";

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

import { ForbiddenError } from "../../shared/errors/forbidden-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";

export async function createInvitationHandler(req: Request, res: Response) {
  try {
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
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid request",
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: error.message,
        },
      });
    }

    console.error("Create invitation error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function listWorkspaceInvitationsHandler(
  req: Request,
  res: Response,
) {
  try {
    const invitations = await listWorkspaceInvitations(
      req.params.workspaceId as string,
      req.user!.id,
    );

    return res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    console.error("List workspace invitations error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function cancelInvitationHandler(req: Request, res: Response) {
  try {
    const result = await cancelInvitation(
      req.user!.id,
      req.params.workspaceId as string,
      req.params.invitationId as string,
    );

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "INVITATION_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Cancel invitation error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function resendInvitationHandler(req: Request, res: Response) {
  try {
    const invitation = await resendInvitation(
      req.user!.id,
      req.params.workspaceId as string,
      req.params.invitationId as string,
    );

    return res.status(200).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "INVITATION_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Resend invitation error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function listUserInvitationsHandler(req: Request, res: Response) {
  try {
    const invitations = await listUserInvitations(req.user!.email);

    return res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    console.error("List user invitations error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function getInvitationPreviewHandler(
  req: Request,
  res: Response,
) {
  try {
    const params = invitationTokenParamSchema.parse(req.params);

    const preview = await getInvitationPreview(params.token);

    return res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid request",
        },
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "INVITATION_NOT_FOUND",
          message: error.message,
        },
      });
    }

    console.error("Get invitation preview error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function acceptInvitationHandler(
  req: Request,
  res: Response,
) {
  try {
    const invitation = await acceptInvitation(
      req.params.invitationId as string,
      req.user!.id,
      req.user!.email,
    );

    return res.status(200).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "INVITATION_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Accept invitation error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function acceptInvitationByTokenHandler(
  req: Request,
  res: Response,
) {
  try {
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
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid request",
        },
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "INVITATION_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Accept invitation by token error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function declineInvitationHandler(
  req: Request,
  res: Response,
) {
  try {
    const invitation = await declineInvitation(
      req.params.invitationId as string,
      req.user!.id,
      req.user!.email,
    );

    return res.status(200).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "INVITATION_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Decline invitation error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}

export async function declineInvitationByTokenHandler(
  req: Request,
  res: Response,
) {
  try {
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
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid request",
        },
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "INVITATION_NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Decline invitation by token error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    });
  }
}