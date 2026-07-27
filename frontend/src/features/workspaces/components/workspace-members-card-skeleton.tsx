import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const skeletonRows = Array.from({ length: 3 }, (_, index) => index);

export function WorkspaceMembersCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          {skeletonRows.map((row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3.5 w-40" />
              </div>
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
