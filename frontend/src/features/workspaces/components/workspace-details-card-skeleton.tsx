import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const skeletonRows = Array.from({ length: 4 }, (_, index) => index);

export function WorkspaceDetailsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          {skeletonRows.map((row) => (
            <div key={row} className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
