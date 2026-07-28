import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
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
  onSuccess?: () => void;
}

export function WorkspaceInviteForm({ workspaceId, actorRole, onSuccess }: WorkspaceInviteFormProps) {
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
      onSuccess?.();
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <Controller
        name="email"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Email</FieldLabel>
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
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Role</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
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

      <DialogFooter className="-mx-6 -mb-6">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Inviting..." : "Invite"}
        </Button>
      </DialogFooter>
    </form>
  );
}
