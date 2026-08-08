import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth";

import { useUpdateName } from "../hooks/use-update-name";
import { updateNameSchema, type UpdateNameFormData } from "../validation/update-name";

interface ProfileNameFormProps {
  name: string;
}

export function ProfileNameForm({ name }: ProfileNameFormProps) {
  const { refetch } = useAuth();
  const updateName = useUpdateName();

  const form = useForm<UpdateNameFormData>({
    resolver: zodResolver(updateNameSchema),
    defaultValues: { name },
  });

  const isSubmitting = form.formState.isSubmitting;
  const isDirty = form.formState.isDirty;

  async function onSubmit(data: UpdateNameFormData) {
    try {
      await updateName.mutateAsync({ name: data.name });
      await refetch();

      toast.success("Name updated successfully!");
      form.reset({ name: data.name });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="max-w-sm">
            <FieldLabel htmlFor={field.name}>Name</FieldLabel>
            <Input
              {...field}
              id={field.name}
              autoComplete="name"
              disabled={isSubmitting}
              aria-invalid={fieldState.invalid}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Button type="submit" className="self-start" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
