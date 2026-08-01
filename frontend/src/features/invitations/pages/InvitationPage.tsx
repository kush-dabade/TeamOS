import { Layers3, MailX } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ux";
import { useAuth } from "@/features/auth";

import { useAcceptInvitation } from "../hooks/use-accept-invitation";
import { useDeclineInvitation } from "../hooks/use-decline-invitation";
import { useInvitationPreview } from "../hooks/use-invitation-preview";
import { InvitationPreviewCard } from "../components/invitation-preview-card";
import { InvitationPreviewCardSkeleton } from "../components/invitation-preview-card-skeleton";

export function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const invitationQuery = useInvitationPreview(token);
  const { isAuthenticated, isPending: isAuthPending } = useAuth();

  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();

  const isProcessing = acceptInvitation.isPending || declineInvitation.isPending;

  async function handleAccept() {
    if (!token) return;

    try {
      await acceptInvitation.mutateAsync(token);
      navigate("/dashboard", { replace: true });
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  async function handleDecline() {
    if (!token) return;

    try {
      await declineInvitation.mutateAsync(token);
    } catch {
      // Failure feedback is already surfaced via the mutation's onError toast.
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 className="size-6 text-foreground" />
            <span className="text-lg font-bold tracking-tight">TeamOS</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">You're invited</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Review the details of your workspace invitation below.
          </p>
        </div>

        {invitationQuery.isPending ? (
          <InvitationPreviewCardSkeleton />
        ) : invitationQuery.isError ? (
          <ErrorState
            icon={MailX}
            title="Invitation not found"
            description="This invitation link is invalid, has expired, or has already been used."
            action={
              <Button asChild>
                <Link to="/">Go to homepage</Link>
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <InvitationPreviewCard invitation={invitationQuery.data} />

            {!isAuthPending && !isAuthenticated ? (
              <div className="flex gap-3">
                <Button asChild className="flex-1">
                  <Link to="/login" state={{ from: location }}>
                    Log in
                  </Link>
                </Button>

                <Button asChild variant="outline" className="flex-1">
                  <Link to="/register" state={{ from: location }}>
                    Create account
                  </Link>
                </Button>
              </div>
            ) : null}

            {!isAuthPending && isAuthenticated ? (
              declineInvitation.isSuccess ? (
                <p className="text-center text-sm text-muted-foreground">
                  You declined this invitation.
                </p>
              ) : (
                <div className="flex gap-3">
                  <Button className="flex-1" disabled={isProcessing} onClick={handleAccept}>
                    {acceptInvitation.isPending ? "Accepting..." : "Accept Invitation"}
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={isProcessing}
                    onClick={handleDecline}
                  >
                    {declineInvitation.isPending ? "Declining..." : "Decline Invitation"}
                  </Button>
                </div>
              )
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
