import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const skeletonRows = Array.from({ length: 3 }, (_, index) => index);

export function WorkspaceMembersCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>

      <CardContent className="flex min-h-48 flex-col">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-8 w-full sm:max-w-64" />
            <Skeleton className="h-7 w-full sm:w-32" />
          </div>

          {skeletonRows.map((row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3.5 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="size-7 rounded-md" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
