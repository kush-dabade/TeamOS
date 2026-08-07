import { formatDate, formatRelativeDate } from "@/utils";

import { SprintStatusBadge } from "../SprintStatusBadge";

import type { Sprint } from "../../types";

interface SprintRowProps {
  sprint: Sprint;
}

// No row selection/onClick yet - there is no preview panel for a click to
// open (deferred to a later commit), so this stays a plain, non-interactive
// row rather than a button that does nothing.
export function SprintRow({ sprint }: SprintRowProps) {
  return (
    <tr className="border-b even:bg-muted/20">
      <th scope="row" className="max-w-0 px-3 py-1.5 text-left font-medium">
        <span className="block truncate leading-5">{sprint.name}</span>
        {sprint.goal ? (
          <span className="block truncate text-xs leading-4 text-muted-foreground">
            {sprint.goal}
          </span>
        ) : null}
      </th>
      <td className="px-3 py-1.5">
        <SprintStatusBadge status={sprint.status} />
      </td>
      <td className="px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
        {sprint.startDate ? formatDate(sprint.startDate, "MMM d, yyyy") : "—"}
      </td>
      <td className="px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
        {sprint.endDate ? formatDate(sprint.endDate, "MMM d, yyyy") : "—"}
      </td>
      <td className="px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
        {formatRelativeDate(sprint.updatedAt)}
      </td>
    </tr>
  );
}
