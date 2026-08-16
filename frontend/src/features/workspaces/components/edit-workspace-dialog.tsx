import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { Workspace } from "../types";

import { WorkspaceEditForm } from "./workspace-edit-form";

interface EditWorkspaceDialogProps {
  workspace: Workspace;
}

export function EditWorkspaceDialog({ workspace }: EditWorkspaceDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil />
          Edit workspace
        </Button>
      </DialogTrigger>

      <DialogContent className="gap-6 p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>
            Update your workspace name. This change is visible to everyone in the workspace.
          </DialogDescription>
        </DialogHeader>

        <WorkspaceEditForm workspace={workspace} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
