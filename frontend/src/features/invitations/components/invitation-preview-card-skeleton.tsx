import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

export function InvitationPreviewCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
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
