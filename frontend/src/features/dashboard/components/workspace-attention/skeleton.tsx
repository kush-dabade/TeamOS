import { Skeleton } from "@/components/ui";

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

export function WorkspaceAttentionSkeleton() {
  return (
    <div className="divide-border divide-y">
      {skeletonRows.map((row) => (
        <div key={row} className="flex items-start gap-3 px-2.5 py-2">
          <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
