import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button, Field, FieldError, FieldLabel } from "@/components/ui";
import { cn } from "@/utils";

import { commentSchema, type CommentFormData } from "../validation/comment";

interface CommentFormProps {
  mode: "create" | "edit";
  initialValue?: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
}

// Shared by the create composer and each comment's inline edit form. `mode`
// controls the one behavioral difference between them: create clears itself
// after a successful submit (the box stays mounted, ready for the next
// comment); edit does not, since a successful edit unmounts this form as its
// parent switches back to the static comment view. `mode` also picks which
// chrome renders - create gets its own bordered surface with Post sitting
// inside it (no divider, just the shared surface), edit renders as a plain
// bordered textarea inline inside the comment it's editing.
export function CommentForm({
  mode,
  initialValue = "",
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: CommentFormProps) {
  const isComposer = mode === "create";

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: initialValue },
  });
  const isSubmitting = form.formState.isSubmitting;

  async function handleValid(data: CommentFormData) {
    try {
      await onSubmit(data.content);

      if (mode === "create") {
        form.reset({ content: "" });
      }
    } catch {
      form.setError("root", { message: "Unable to save comment. Please try again." });
    }
  }

  const textarea = (
    <Controller
      name="content"
      control={form.control}
      render={({ field, fieldState }) => {
        const errorId = `${field.name}-error`;

        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name} className="sr-only">
              Comment
            </FieldLabel>
            <textarea
              {...field}
              id={field.name}
              rows={3}
              placeholder={placeholder}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? errorId : undefined}
              className={cn(
                "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
                isComposer
                  ? "resize-none border-0 p-0"
                  : "min-h-16 resize-y rounded-lg border border-input px-2.5 py-2 transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
              )}
            />
            <FieldError id={errorId} errors={[fieldState.error]} />
          </Field>
        );
      }}
    />
  );

  const actions = (
    <>
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      ) : null}
      <Button type="submit" size={isComposer ? "xs" : "sm"} disabled={isSubmitting}>
        {isSubmitting ? (isComposer ? "Posting..." : "Saving...") : submitLabel}
      </Button>
    </>
  );

  if (isComposer) {
    return (
      <form
        onSubmit={form.handleSubmit(handleValid)}
        noValidate
        className="rounded-lg bg-card ring-1 ring-foreground/10"
      >
        <div className="px-3.5 pt-3.5">{textarea}</div>

        <FieldError errors={[form.formState.errors.root]} className="px-3.5" />

        <div className="flex items-center justify-end px-3.5 pb-3.5 pt-1">{actions}</div>
      </form>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-2" noValidate>
      {textarea}

      <FieldError errors={[form.formState.errors.root]} />

      <div className="flex items-center justify-end gap-2">{actions}</div>
    </form>
  );
}
