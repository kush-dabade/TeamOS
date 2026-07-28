import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { WorkspaceRole } from "../types";

import { WorkspaceInviteForm } from "./workspace-invite-form";

interface InviteMemberDialogProps {
  workspaceId: string;
  actorRole: WorkspaceRole;
}

export function InviteMemberDialog({ workspaceId, actorRole }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <UserPlus />
          Invite Member
        </Button>
      </DialogTrigger>

      <DialogContent className="gap-6 p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email invitation to join this workspace with the role you
            choose below.
          </DialogDescription>
        </DialogHeader>

        <WorkspaceInviteForm
          workspaceId={workspaceId}
          actorRole={actorRole}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
