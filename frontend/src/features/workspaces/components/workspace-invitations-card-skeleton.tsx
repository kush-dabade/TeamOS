import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const skeletonRows = Array.from({ length: 2 }, (_, index) => index);

export function WorkspaceInvitationsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
      </CardHeader>

      <CardContent className="flex min-h-48 flex-col">
        <div className="flex flex-1 flex-col gap-4">
          {skeletonRows.map((row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-7 rounded-md" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
