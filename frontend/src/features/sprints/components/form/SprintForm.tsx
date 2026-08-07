import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { RefObject } from "react";

import { Button, Field, FieldError, FieldLabel, Input } from "@/components/ui";

import { sprintSchema, type SprintFormData } from "../../validation/sprint";

interface SprintFormProps {
  mode: "create" | "edit";
  defaultValues: SprintFormData;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (data: SprintFormData) => void | Promise<void>;
  onCancel: () => void;
}

export function SprintForm({
  mode,
  defaultValues,
  nameInputRef,
  onSubmit,
  onCancel,
}: SprintFormProps) {
  const form = useForm<SprintFormData>({
    resolver: zodResolver(sprintSchema),
    defaultValues,
  });
  const isSubmitting = form.formState.isSubmitting;

  async function handleSubmit(data: SprintFormData) {
    try {
      await onSubmit(data);
    } catch {
      form.setError("root", { message: "Unable to save sprint. Please try again." });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Sprint Name</FieldLabel>
                  <Input
                    {...field}
                    ref={nameInputRef}
                    id={field.name}
                    placeholder="Sprint 12"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? errorId : undefined}
                  />
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />

          <Controller
            name="goal"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Goal</FieldLabel>
                  <textarea
                    {...field}
                    id={field.name}
                    rows={4}
                    placeholder="What should this sprint accomplish?"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? errorId : undefined}
                    className="min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                  />
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />

          <Controller
            name="startDate"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Start Date</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="date"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? errorId : undefined}
                  />
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />

          <Controller
            name="endDate"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>End Date</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="date"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? errorId : undefined}
                  />
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />

          <FieldError errors={[form.formState.errors.root]} />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end gap-2 border-t p-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : mode === "create" ? "Create sprint" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
