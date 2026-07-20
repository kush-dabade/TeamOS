import { Skeleton } from "@/components/ui";

const skeletonRows = Array.from({ length: 4 }, (_, index) => index);

export function ContinueWorkingSkeleton() {
  return (
    <div className="divide-border divide-y">
      {skeletonRows.map((row) => (
        <div key={row} className="flex items-start gap-3 px-2.5 py-2">
          <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
