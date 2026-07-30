import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button, Field, FieldError, FieldLabel } from "@/components/ui";

import { commentSchema, type CommentFormData } from "../validation/comment";

interface CommentFormProps {
  mode: "create" | "edit";
  initialValue?: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
}

// Shared by the create box and each comment's inline edit form. `mode`
// controls the one behavioral difference between them: create clears itself
// after a successful submit (the box stays mounted, ready for the next
// comment); edit does not, since a successful edit unmounts this form as its
// parent switches back to the static comment view.
export function CommentForm({
  mode,
  initialValue = "",
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: CommentFormProps) {
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

  return (
    <form onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-2" noValidate>
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
                rows={mode === "create" ? 2 : 3}
                placeholder={placeholder}
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? errorId : undefined}
                className="min-h-16 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
              />
              <FieldError id={errorId} errors={[fieldState.error]} />
            </Field>
          );
        }}
      />

      <FieldError errors={[form.formState.errors.root]} />

      <div className="flex items-center justify-end gap-2">
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
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
