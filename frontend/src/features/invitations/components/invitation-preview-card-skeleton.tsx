import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const skeletonRows = Array.from({ length: 3 }, (_, index) => index);

export function InvitationPreviewCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-col items-center gap-2">
        <Skeleton className="size-12 rounded-md" />

        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-36" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          <Skeleton className="mx-auto h-3.5 w-48" />

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            {skeletonRows.map((row) => (
              <div key={row} className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
