import type { RefObject } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

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
import { getErrorMessage } from "@/utils";

const UNASSIGNED_VALUE = "UNASSIGNED";

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
    } catch (error) {
      form.setError("root", { message: getErrorMessage(error) });
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
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
                    ref={(element) => {
                      field.ref(element);
                      titleInputRef.current = element;
                    }}
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
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mode === "edit"}
                  >
                    <SelectTrigger
                      id={field.name}
                      aria-required="true"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        mode === "edit" ? `${field.name}-hint` : fieldState.error ? errorId : undefined
                      }
                      className="w-full"
                    >
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {mode === "edit" ? (
                    <p id={`${field.name}-hint`} className="text-xs text-muted-foreground">
                      Project can only be selected when creating a task.
                    </p>
                  ) : (
                    <FieldError id={errorId} errors={[fieldState.error]} />
                  )}
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
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />

          {mode === "edit" ? (
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
                          <SelectItem value="TODO">Todo</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="REVIEW">Review</SelectItem>
                          <SelectItem value="DONE">Done</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError id={errorId} errors={[fieldState.error]} />
                  </Field>
                );
              }}
            />
          ) : null}

          <Controller
            name="assigneeId"
            control={form.control}
            render={({ field, fieldState }) => {
              const errorId = `${field.name}-error`;

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Assignee</FieldLabel>
                  <Select
                    value={field.value === "" ? UNASSIGNED_VALUE : field.value}
                    onValueChange={(value) =>
                      field.onChange(value === UNASSIGNED_VALUE ? "" : value)
                    }
                  >
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
                        <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                        {assignees.map((assignee) => (
                          <SelectItem key={assignee.id} value={assignee.id}>
                            {assignee.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
          {isSubmitting ? "Saving..." : mode === "create" ? "Create task" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
