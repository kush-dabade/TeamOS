import { Layers3, MailX } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ux";

import { useInvitationPreview } from "../hooks/use-invitation-preview";
import { InvitationPreviewCard } from "../components/invitation-preview-card";
import { InvitationPreviewCardSkeleton } from "../components/invitation-preview-card-skeleton";

export function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const invitationQuery = useInvitationPreview(token);

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
          <InvitationPreviewCard invitation={invitationQuery.data} />
        )}
      </div>
    </main>
  );
}
