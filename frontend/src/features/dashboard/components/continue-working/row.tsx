import { ChevronRight, FolderKanban } from "lucide-react";

import { ProjectStatusBadge } from "@/features/projects/components/ProjectStatusBadge";
import { formatRelativeDate } from "@/utils";

import type { ContinueWorkingItem } from "../../types";

interface ContinueWorkingRowProps {
  item: ContinueWorkingItem;
  onSelect: (item: ContinueWorkingItem) => void;
}

export function ContinueWorkingRow({ item, onSelect }: ContinueWorkingRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="
        group w-full
        rounded-md
        px-2.5 py-2
        text-left
        transition-colors duration-150
        hover:bg-muted/50
        focus-visible:outline-hidden
        focus-visible:ring-2
        focus-visible:ring-ring
      "
    >
      <div className="flex items-start gap-3">
        <span className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
          <FolderKanban className="text-muted-foreground h-3.5 w-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-medium leading-5">{item.name}</span>

            <ChevronRight
              className="
                text-muted-foreground
                mt-0.5 h-3.5 w-3.5
                shrink-0
                opacity-0
                transition-all duration-150
                group-hover:translate-x-0.5
                group-hover:opacity-100
              "
            />
          </div>

          <div className="mt-1 flex items-center gap-2">
            <ProjectStatusBadge status={item.status} />
            <span className="text-muted-foreground truncate text-xs">
              updated {formatRelativeDate(item.lastActivityAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
