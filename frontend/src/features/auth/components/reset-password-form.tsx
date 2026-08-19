import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, MailX } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { resetPassword } from "../api/auth.api";
import { resetPasswordSchema, type ResetPasswordFormData } from "../validation/reset-password";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState, EmptyState } from "@/components/ux";
import { isAppError } from "@/lib/api";
import { getErrorMessage } from "@/utils";

// Matches Better Auth's own error codes for this flow (installed
// better-auth package's api/routes/password.ts): the GET
// /reset-password/:token redirect callback only ever appends
// ?error=INVALID_TOKEN (missing/expired/already-consumed token), and the
// POST /reset-password submit handler throws the same code for the same
// reasons. Same "known-code lookup, generic fallback for anything else"
// pattern as VerifyEmailPage's VERIFICATION_ERROR_MESSAGES.
const RESET_LINK_ERROR_MESSAGE =
  "This password reset link is invalid or has expired. Request a new one to continue.";

function InvalidResetLink() {
  return (
    <Card className="border-0 shadow-none">
      <CardContent>
        <ErrorState
          icon={MailX}
          title="Link expired"
          description={RESET_LINK_ERROR_MESSAGE}
          action={
            <Button asChild>
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const linkErrorCode = searchParams.get("error");

  // Set once resetPassword itself rejects with INVALID_TOKEN (as opposed to
  // the link already carrying ?error=INVALID_TOKEN before the form ever
  // rendered) - e.g. the token expired in the few minutes the user spent on
  // this page, or was already consumed by a second tab. Same terminal
  // "swap to InvalidResetLink" treatment either way, since retrying the
  // same form can't succeed.
  const [tokenRejected, setTokenRejected] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: ResetPasswordFormData) {
    if (!token) {
      return;
    }

    try {
      await resetPassword({ token, newPassword: data.newPassword });

      setResetComplete(true);
    } catch (error) {
      if (isAppError(error) && error.code === "INVALID_TOKEN") {
        setTokenRejected(true);
        return;
      }

      toast.error(getErrorMessage(error));
    }
  }

  if (linkErrorCode || !token || tokenRejected) {
    return <InvalidResetLink />;
  }

  if (resetComplete) {
    return (
      <Card className="border-0 shadow-none">
        <CardContent>
          <EmptyState
            icon={MailCheck}
            title="Password reset"
            description="Your password has been changed. You can now sign in with your new password."
            action={
              <Button asChild>
                <Link to="/login">Continue to login</Link>
              </Button>
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
            name="newPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>New password</FieldLabel>

                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a new password"
                  aria-invalid={fieldState.invalid}
                />

                <FieldDescription>
                  Password must contain: 8+ characters · uppercase · lowercase · number
                </FieldDescription>

                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="confirmPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Confirm new password</FieldLabel>

                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm your new password"
                  aria-invalid={fieldState.invalid}
                />

                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
