import { Button } from "@/components/ui/button";
import { useResendVerificationEmail } from "@/features/auth";
import { cn } from "@/utils";

interface EmailVerificationStatusProps {
  email: string;
  emailVerified: boolean;
}

// With mandatory email verification on (the backend default,
// backend/src/lib/auth.ts), unverified accounts can't sign in, so this
// normally renders "Verified". When the backend sets
// REQUIRE_EMAIL_VERIFICATION=false, new accounts sign in unverified and the
// `!emailVerified` branch below is how they can still verify voluntarily.
export function EmailVerificationStatus({ email, emailVerified }: EmailVerificationStatusProps) {
  const resendVerification = useResendVerificationEmail();

  return (
    <>
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
          emailVerified ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
        )}
      >
        {emailVerified ? "Verified" : "Not verified"}
      </span>

      {!emailVerified ? (
        <Button
          type="button"
          size="sm"
          disabled={resendVerification.isPending}
          onClick={() => resendVerification.mutate(email)}
        >
          {resendVerification.isPending ? "Sending..." : "Resend verification email"}
        </Button>
      ) : null}
    </>
  );
}
