import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { register } from "../api/auth.api";
import { useResendVerificationEmail } from "../hooks/use-resend-verification-email";
import { registerSchema, type RegisterFormData } from "../validation/register";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ux";
import { getErrorMessage } from "@/utils";

export function RegisterForm() {
  const location = useLocation();

  // Set only after a successful sign-up, from the submitted form data (not
  // reconstructed from anywhere else) - holds the email so the confirmation
  // panel and its resend action below know where the verification link was
  // sent, without introducing a separate route or global state for it.
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const resendVerification = useResendVerificationEmail();

  async function onSubmit(data: RegisterFormData) {
    try {
      await register({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      // Sign-up no longer creates a session (email verification is
      // required first, backend/src/lib/auth.ts) - stay on this page and
      // show an in-place confirmation instead of navigating to /login, so
      // the "verify your email" step isn't a toast the user can miss.
      setRegisteredEmail(data.email);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  if (registeredEmail) {
    return (
      <Card className="border-0 shadow-none">
        <CardContent>
          <EmptyState
            icon={Mail}
            title="Check your email"
            description={`We sent a verification link to ${registeredEmail}. Verify your email to finish setting up your account.`}
            action={
              <div className="flex flex-col items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={resendVerification.isPending}
                  onClick={() => resendVerification.mutate(registeredEmail)}
                >
                  {resendVerification.isPending ? "Sending..." : "Resend verification email"}
                </Button>

                <Link
                  to="/login"
                  state={location.state}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Continue to login
                </Link>

                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setRegisteredEmail(null)}
                >
                  Use a different email
                </button>
              </div>
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
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Full name</FieldLabel>

                <Input
                  {...field}
                  id={field.name}
                  autoComplete="name"
                  placeholder="John Doe"
                  aria-invalid={fieldState.invalid}
                />

                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

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
                  autoComplete="new-password"
                  placeholder="Create a password"
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
                <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>

                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  aria-invalid={fieldState.invalid}
                />

                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              state={location.state}
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
