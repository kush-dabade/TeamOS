import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useLeaveWorkspace } from "../hooks/use-leave-workspace";

interface LeaveWorkspaceDialogProps {
  workspaceId: string;
  workspaceName: string;
}

export function LeaveWorkspaceDialog({ workspaceId, workspaceName }: LeaveWorkspaceDialogProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const leaveWorkspace = useLeaveWorkspace(workspaceId);

  async function handleConfirmLeave() {
    try {
      await leaveWorkspace.mutateAsync();

      toast.success(`You left ${workspaceName}.`);
      setOpen(false);
      navigate("/dashboard", { replace: true });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Leave Workspace
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave {workspaceName}?</DialogTitle>
          <DialogDescription>
            You will immediately lose access to this workspace and its projects, tasks, and
            comments. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmLeave}
            disabled={leaveWorkspace.isPending}
          >
            {leaveWorkspace.isPending ? "Leaving..." : "Leave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
