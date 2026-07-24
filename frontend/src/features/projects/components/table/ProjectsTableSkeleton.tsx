import { Skeleton } from "@/components/ui";

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

export function ProjectsTableSkeleton() {
  return (
    <>
      {skeletonRows.map((row) => (
        <tr key={row} className="border-b last:border-b-0">
          <td className="px-3 py-1.5"><Skeleton className="h-4 w-40" /></td>
          <td className="px-3 py-1.5"><Skeleton className="h-5 w-16 rounded-full" /></td>
          <td className="px-3 py-1.5"><Skeleton className="h-1.5 w-24" /></td>
          <td className="px-3 py-1.5"><Skeleton className="h-4 w-12" /></td>
          <td className="px-3 py-1.5"><Skeleton className="h-4 w-14" /></td>
        </tr>
      ))}
    </>
  );
}
