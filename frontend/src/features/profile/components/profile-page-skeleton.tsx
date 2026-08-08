import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfilePageSkeleton() {
  return (
    <>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <Skeleton className="size-10 rounded-full" />

          <div className="flex flex-col gap-4">
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-8 w-full max-w-sm" />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3.5 w-56" />
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-8 w-full max-w-sm" />
          <Skeleton className="h-8 w-full max-w-sm" />
          <Skeleton className="h-8 w-full max-w-sm" />
        </CardContent>
      </Card>
    </>
  );
}
