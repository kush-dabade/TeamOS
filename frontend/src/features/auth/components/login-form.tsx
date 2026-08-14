import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { login, resendVerificationEmail } from "../api/auth.api";
import { getPostAuthRedirect } from "../lib/redirect";
import { loginSchema, type LoginFormData } from "../validation/login";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ux";
import { isAppError } from "@/lib/api";
import { getErrorMessage } from "@/utils";

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();

  // Set only when Better Auth's structured EMAIL_NOT_VERIFIED code is seen
  // (not inferred from message text) - holds the submitted email so the
  // resend action below knows where to send, without introducing separate
  // global/persisted state for it.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const resendVerification = useMutation({
    mutationFn: resendVerificationEmail,
    onSuccess: () => {
      toast.success("Verification email sent. Check your inbox.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  async function onSubmit(data: LoginFormData) {
    setUnverifiedEmail(null);

    try {
      await login(data);

      toast.success("Welcome back!");

      navigate(getPostAuthRedirect(location), { replace: true });
    } catch (error) {
      if (isAppError(error) && error.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(data.email);
        return;
      }

      toast.error(getErrorMessage(error));
    }
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

          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>

                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={fieldState.invalid}
                />

                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </Button>

          {unverifiedEmail ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <EmptyState
                icon={Mail}
                title="Email not verified"
                description="Your email address needs to be verified before you can sign in."
                action={
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={resendVerification.isPending}
                      onClick={() => resendVerification.mutate(unverifiedEmail)}
                    >
                      {resendVerification.isPending ? "Sending..." : "Resend verification email"}
                    </Button>

                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => setUnverifiedEmail(null)}
                    >
                      Back to login
                    </button>
                  </div>
                }
              />
            </div>
          ) : null}

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/register"
              state={location.state}
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
