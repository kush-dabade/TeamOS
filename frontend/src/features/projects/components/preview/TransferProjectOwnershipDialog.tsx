import { useState } from "react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { useWorkspaceMembers } from "@/features/workspaces";
import { ROLE_LABELS, isEligibleOwnershipTransferTarget } from "@/features/workspaces/lib/workspace-roles";

import { useTransferProjectOwnership } from "../../hooks/use-transfer-project-ownership";

interface TransferProjectOwnershipDialogProps {
  projectId: string;
  projectName: string;
  workspaceId: string;
  currentOwnerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferProjectOwnershipDialog({
  projectId,
  projectName,
  workspaceId,
  currentOwnerId,
  open,
  onOpenChange,
}: TransferProjectOwnershipDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState("");

  const membersQuery = useWorkspaceMembers(workspaceId);
  const transferOwnership = useTransferProjectOwnership(projectId);

  const eligibleMembers = (membersQuery.data ?? []).filter(
    (member) => isEligibleOwnershipTransferTarget(member.role) && member.userId !== currentOwnerId,
  );

  const selectedMember = eligibleMembers.find((member) => member.userId === selectedUserId);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setSelectedUserId("");
    }
  }

  async function handleConfirmTransfer() {
    if (!selectedMember) {
      return;
    }

    try {
      await transferOwnership.mutateAsync(selectedMember.userId);
      toast.success(`Ownership of ${projectName} transferred to ${selectedMember.name}.`);
      handleOpenChange(false);
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer ownership of {projectName}?</DialogTitle>
          <DialogDescription>
            Choose an eligible workspace member to become the owner of this project.
          </DialogDescription>
        </DialogHeader>

        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a member" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {eligibleMembers.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.name} ({ROLE_LABELS[member.role]})
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {selectedMember ? (
          <p className="text-sm text-muted-foreground">
            {selectedMember.name} will become the owner of {projectName}. This change is immediate
            and cannot be undone.
          </p>
        ) : null}

        <DialogFooter showCloseButton>
          <Button
            type="button"
            onClick={handleConfirmTransfer}
            disabled={!selectedMember || transferOwnership.isPending}
          >
            {transferOwnership.isPending ? "Transferring..." : "Transfer Ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
