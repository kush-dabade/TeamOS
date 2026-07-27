import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCreateInvitation } from "../hooks/use-create-invitation";
import { ROLE_LABELS, getAssignableRoles } from "../lib/workspace-roles";
import type { WorkspaceRole } from "../types";
import {
  createInvitationSchema,
  type CreateInvitationFormData,
} from "../validation/create-invitation";

interface WorkspaceInviteFormProps {
  workspaceId: string;
  actorRole: WorkspaceRole;
}

export function WorkspaceInviteForm({ workspaceId, actorRole }: WorkspaceInviteFormProps) {
  const createInvitation = useCreateInvitation(workspaceId);
  const assignableRoles = getAssignableRoles(actorRole);
  const defaultRole: CreateInvitationFormData["role"] = assignableRoles.includes("MEMBER")
    ? "MEMBER"
    : (assignableRoles[0] as CreateInvitationFormData["role"]);

  const form = useForm<CreateInvitationFormData>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: { email: "", role: defaultRole },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: CreateInvitationFormData) {
    try {
      await createInvitation.mutateAsync(data);

      toast.success("Invitation sent successfully!");
      form.reset({ email: "", role: defaultRole });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <h3 className="text-xs font-medium text-muted-foreground">Invite Member</h3>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field className="sm:flex-1" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name} className="sr-only">
                Email
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder="teammate@company.com"
                disabled={isSubmitting}
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="role"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field className="sm:w-40">
              <FieldLabel htmlFor={field.name} className="sr-only">
                Role
              </FieldLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSubmitting}
              >
                <SelectTrigger id={field.name} className="w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {assignableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? "Inviting..." : "Invite"}
        </Button>
      </div>
    </form>
  );
}
