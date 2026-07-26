import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { RefObject } from "react";

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

import { projectSchema, type ProjectFormData } from "../../validation/project";

interface ProjectFormProps {
  mode: "create" | "edit";
  defaultValues: ProjectFormData;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (data: ProjectFormData) => void | Promise<void>;
  onCancel: () => void;
}

export function ProjectForm({
  mode,
  defaultValues,
  nameInputRef,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues,
  });
  const isSubmitting = form.formState.isSubmitting;

  async function handleSubmit(data: ProjectFormData) {
    try {
      await onSubmit(data);
    } catch {
      form.setError("root", { message: "Unable to save project. Please try again." });
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
                  <FieldLabel htmlFor={field.name}>Project Name</FieldLabel>
                  <Input
                    {...field}
                    ref={nameInputRef}
                    id={field.name}
                    placeholder="Website Redesign"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? errorId : undefined}
                  />
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />

          <Controller
            name="description"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                  <textarea
                    {...field}
                    id={field.name}
                    rows={4}
                    placeholder="Describe the project..."
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
            name="status"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={fieldState.error ? errorId : undefined}
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="PLANNED">Planned</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
          {isSubmitting ? "Saving..." : mode === "create" ? "Create project" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
