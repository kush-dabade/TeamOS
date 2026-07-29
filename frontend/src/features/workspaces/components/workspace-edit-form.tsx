import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { useUpdateWorkspace } from "../hooks/use-update-workspace";
import type { Workspace } from "../types";
import { updateWorkspaceSchema, type UpdateWorkspaceFormData } from "../validation/update-workspace";

interface WorkspaceEditFormProps {
  workspace: Workspace;
  onSuccess?: () => void;
}

export function WorkspaceEditForm({ workspace, onSuccess }: WorkspaceEditFormProps) {
  const updateWorkspace = useUpdateWorkspace(workspace.id);
  const isOwner = workspace.role === "OWNER";

  const form = useForm<UpdateWorkspaceFormData>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: { name: workspace.name },
  });

  const isSubmitting = form.formState.isSubmitting;
  const isDirty = form.formState.isDirty;

  async function onSubmit(data: UpdateWorkspaceFormData) {
    try {
      await updateWorkspace.mutateAsync({ name: data.name });

      toast.success("Workspace updated successfully!");
      form.reset({ name: data.name });
      onSuccess?.();
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Workspace Name</FieldLabel>
            <Input
              {...field}
              id={field.name}
              disabled={!isOwner || isSubmitting}
              aria-invalid={fieldState.invalid}
            />
            {!isOwner ? (
              <FieldDescription>
                Only the workspace owner can rename the workspace.
              </FieldDescription>
            ) : null}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      {isOwner ? (
        <DialogFooter className="-mx-6 -mb-6">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      ) : null}
    </form>
  );
}
