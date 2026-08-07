import { Skeleton } from "@/components/ui";

const skeletonRows = Array.from({ length: 3 }, (_, index) => index);

export function SprintsTableSkeleton() {
  return (
    <>
      {skeletonRows.map((row) => (
        <tr key={row} className="border-b last:border-b-0">
          <td className="px-3 py-1.5">
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-52" />
            </div>
          </td>
          <td className="px-3 py-1.5"><Skeleton className="h-5 w-16 rounded-full" /></td>
          <td className="px-3 py-1.5"><Skeleton className="h-4 w-20" /></td>
          <td className="px-3 py-1.5"><Skeleton className="h-4 w-20" /></td>
          <td className="px-3 py-1.5"><Skeleton className="h-4 w-14" /></td>
        </tr>
      ))}
    </>
  );
}
