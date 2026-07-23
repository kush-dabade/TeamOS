import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { useCreateWorkspace } from "../hooks/use-create-workspace";
import {
  createWorkspaceSchema,
  type CreateWorkspaceFormData,
} from "../validation/create-workspace";

export function CreateWorkspaceForm() {
  const navigate = useNavigate();
  const createWorkspace = useCreateWorkspace();

  const form = useForm<CreateWorkspaceFormData>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: CreateWorkspaceFormData) {
    try {
      await createWorkspace.mutateAsync(data);

      toast.success("Workspace created successfully!");

      navigate("/dashboard", { replace: true });
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
            <FieldLabel htmlFor={field.name}>Workspace name</FieldLabel>

            <Input
              {...field}
              id={field.name}
              autoFocus
              autoComplete="off"
              placeholder="Acme Inc"
              aria-invalid={fieldState.invalid}
            />

            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating workspace..." : "Create Workspace"}
      </Button>
    </form>
  );
}
