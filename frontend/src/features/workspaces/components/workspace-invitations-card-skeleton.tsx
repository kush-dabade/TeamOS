import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const skeletonRows = Array.from({ length: 2 }, (_, index) => index);

export function WorkspaceInvitationsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Skeleton className="h-9 sm:flex-1" />
            <Skeleton className="h-9 sm:w-40" />
            <Skeleton className="h-9 w-20" />
          </div>

          <div className="flex flex-col gap-4">
            {skeletonRows.map((row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
