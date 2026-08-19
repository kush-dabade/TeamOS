import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { requestPasswordReset } from "../api/auth.api";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "../validation/forgot-password";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ux";
import { getErrorMessage } from "@/utils";

export function ForgotPasswordForm() {
  // Set only after a successful submit, from the submitted form data (same
  // pattern as RegisterForm's registeredEmail) - holds the email so the
  // confirmation panel's copy can reference it. Shown on every successful
  // response regardless of whether the account actually exists: the backend
  // (backend/src/lib/auth.ts's sendResetPassword + Better Auth's own
  // requestPasswordReset handler) always returns the same 200 response
  // either way, specifically to prevent account enumeration - this
  // component has no way to know, and must not imply otherwise.
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: ForgotPasswordFormData) {
    try {
      await requestPasswordReset(data.email);

      setSubmittedEmail(data.email);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  if (submittedEmail) {
    return (
      <Card className="border-0 shadow-none">
        <CardContent>
          <EmptyState
            icon={Mail}
            title="Check your email"
            description="If an account exists for that email address, you'll receive a password reset link shortly."
            action={
              <Link
                to="/login"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Back to login
              </Link>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      <CardContent>
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
                  autoComplete="email"
                  placeholder="name@example.com"
                  aria-invalid={fieldState.invalid}
                />

                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Back to login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
