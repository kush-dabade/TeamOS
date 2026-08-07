import { useRef } from "react";

import { formatDate, formatRelativeDate } from "@/utils";

import { SprintStatusBadge } from "../SprintStatusBadge";

import type { Sprint } from "../../types";

interface SprintRowProps {
  sprint: Sprint;
  isSelected: boolean;
  onSelect: (sprintId: string, trigger: HTMLButtonElement | null) => void;
}

export function SprintRow({ sprint, isSelected, onSelect }: SprintRowProps) {
  const sprintNameButtonRef = useRef<HTMLButtonElement>(null);

  const selectSprint = () => onSelect(sprint.id, sprintNameButtonRef.current);

  return (
    <tr
      aria-selected={isSelected}
      onClick={selectSprint}
      className="cursor-pointer border-b transition-colors even:bg-muted/20 hover:bg-muted/50 aria-selected:bg-muted/70"
    >
      <th scope="row" className="max-w-0 px-3 py-1.5 text-left font-medium">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            selectSprint();
          }}
          ref={sprintNameButtonRef}
          className="block w-full truncate rounded-sm text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block truncate leading-5">{sprint.name}</span>
          {sprint.goal ? (
            <span className="block truncate text-xs leading-4 text-muted-foreground">
              {sprint.goal}
            </span>
          ) : null}
        </button>
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
