import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/utils/formatDate";

import { useUpdateWorkspace } from "../hooks/use-update-workspace";
import { ROLE_LABELS } from "../lib/workspace-roles";
import type { Workspace } from "../types";
import { updateWorkspaceSchema, type UpdateWorkspaceFormData } from "../validation/update-workspace";

interface WorkspaceGeneralSettingsCardProps {
  workspace: Workspace;
}

export function WorkspaceGeneralSettingsCard({ workspace }: WorkspaceGeneralSettingsCardProps) {
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
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
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

          <Field>
            <FieldTitle>Workspace Slug</FieldTitle>
            <FieldContent>
              <p className="text-sm text-muted-foreground">{workspace.slug}</p>
            </FieldContent>
          </Field>

          <Field>
            <FieldTitle>Your Role</FieldTitle>
            <FieldContent>
              <p className="text-sm text-muted-foreground">{ROLE_LABELS[workspace.role]}</p>
            </FieldContent>
          </Field>

          <Field>
            <FieldTitle>Created</FieldTitle>
            <FieldContent>
              <p className="text-sm text-muted-foreground">{formatDate(workspace.createdAt)}</p>
            </FieldContent>
          </Field>

          {workspace.updatedAt ? (
            <Field>
              <FieldTitle>Last Updated</FieldTitle>
              <FieldContent>
                <p className="text-sm text-muted-foreground">{formatDate(workspace.updatedAt)}</p>
              </FieldContent>
            </Field>
          ) : null}

          {isOwner ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
