import { Button } from "@/components/ui/button";
import { useResendVerificationEmail } from "@/features/auth";
import { cn } from "@/utils";

interface EmailVerificationStatusProps {
  email: string;
  emailVerified: boolean;
}

// Better Auth's `requireEmailVerification` (backend/src/lib/auth.ts) blocks
// sign-in for unverified accounts, so a normal authenticated session should
// already have `emailVerified: true` by the time this renders. The
// `!emailVerified` branch below is defensive/completeness UI for accounts
// that predate that requirement, unusual existing sessions, or future auth
// changes - not a state the current sign-up/sign-in flow can normally produce.
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
