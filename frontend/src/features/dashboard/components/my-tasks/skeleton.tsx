import { Skeleton } from "@/components/ui";

const skeletonRows = Array.from({ length: 7 }, (_, index) => index);

export function MyTasksTableSkeleton() {
  return (
    <>
      {skeletonRows.map((row) => (
        <tr key={row} className="border-b last:border-b-0">
          <td className="px-3 py-1.5">
            <Skeleton className="h-4 w-48" />
          </td>
          <td className="px-3 py-1.5">
            <Skeleton className="h-4 w-28" />
          </td>
          <td className="px-3 py-1.5">
            <Skeleton className="h-4 w-20" />
          </td>
          <td className="px-3 py-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
          </td>
          <td className="px-3 py-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
          </td>
        </tr>
      ))}
    </>
  );
}
