import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

export function WorkspaceGeneralSettingsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-20" />
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-5">
          {skeletonRows.map((row) => (
            <div key={row} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-5 w-full max-w-64" />
            </div>
          ))}

          <div className="flex justify-end">
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
