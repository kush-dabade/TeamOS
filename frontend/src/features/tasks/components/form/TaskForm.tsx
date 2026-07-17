import type { RefObject } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button, Field, FieldError, FieldLabel, Input } from "@/components/ui";

import type { TaskAssignee, TaskProject } from "../../types";
import { taskSchema, type TaskFormData } from "../../validation/task";

interface TaskFormProps {
  mode: "create" | "edit";
  defaultValues: TaskFormData;
  projects: TaskProject[];
  assignees: TaskAssignee[];
  titleInputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (data: TaskFormData) => void | Promise<void>;
  onCancel: () => void;
}

export function TaskForm({
  mode,
  defaultValues,
  projects,
  assignees,
  titleInputRef,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues,
  });
  const isSubmitting = form.formState.isSubmitting;

  async function handleSubmit(data: TaskFormData) {
    try {
      await onSubmit(data);
    } catch {
      form.setError("root", { message: "Unable to save task. Please try again." });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <Controller
            name="title"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    Title <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    ref={titleInputRef}
                    id={field.name}
                    placeholder="Review homepage conversion path"
                    required
                    aria-required="true"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? errorId : undefined}
                  />
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />

          <Controller
            name="projectId"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    Project <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <select
                    {...field}
                    id={field.name}
                    required
                    aria-required="true"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? errorId : undefined}
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-hidden transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                  >
                    <option value="">Select a project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
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
                    placeholder="Describe the task..."
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
            name="priority"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Priority</FieldLabel>
                  <select
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? errorId : undefined}
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-hidden transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />

          <Controller
            name="assigneeId"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Assignee</FieldLabel>
                  <select
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? errorId : undefined}
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-hidden transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.name}
                      </option>
                    ))}
                  </select>
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />

          <Controller
            name="dueDate"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Due Date</FieldLabel>
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
          {isSubmitting ? "Saving..." : mode === "create" ? "Create Task" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
