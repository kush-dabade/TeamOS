import { Layers3, MailCheck, MailX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ux";

// Matches BASE_ERROR_CODES in the installed better-auth package
// (@better-auth/core/dist/utils/error-codes.mjs) - the `code` Better Auth
// appends as ?error=<code> when it redirects here after a failed
// /api/auth/verify-email call. Any code not listed here falls back to a
// generic message rather than being left unhandled.
const VERIFICATION_ERROR_MESSAGES: Record<string, string> = {
  TOKEN_EXPIRED: "This verification link has expired. Please request a new one.",
  INVALID_TOKEN: "This verification link is invalid or has already been used.",
  USER_NOT_FOUND: "We couldn't find an account for this verification link.",
};

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get("error");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <Layers3 className="size-6 text-foreground" />
            <span className="text-lg font-semibold tracking-tight">TeamOS</span>
          </div>
        </div>

        {errorCode ? (
          <ErrorState
            icon={MailX}
            title="Verification failed"
            description={
              VERIFICATION_ERROR_MESSAGES[errorCode] ??
              "This verification link is invalid or has expired."
            }
            action={
              <Button asChild>
                <Link to="/login">Back to login</Link>
              </Button>
            }
          />
        ) : (
          // Better Auth's /verify-email endpoint redirects here with no
          // query params on success (it re-throws the callbackURL as-is -
          // see verifyEmail in email-verification.mjs) - so this same state
          // also renders if someone opens this URL directly with no
          // verification event. The copy below is worded to stay true
          // either way, rather than asserting a fact ("your email is now
          // verified") we can't actually confirm from a bare page load.
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <MailCheck className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold tracking-tight">You're all set</h1>

              <p className="max-w-sm text-sm text-muted-foreground">
                If you just clicked a verification link from your email, your account is now
                verified. You can continue to log in.
              </p>
            </div>

            <div className="mt-2">
              <Button asChild>
                <Link to="/login">Continue to login</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default VerifyEmailPage;
