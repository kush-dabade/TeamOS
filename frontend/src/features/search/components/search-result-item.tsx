import type { LucideIcon } from "lucide-react";

import { CommandItem } from "@/components/ui";

interface SearchResultItemProps {
  value: string;
  icon: LucideIcon;
  title: string;
  description: string | null;
  onSelect: () => void;
}

// Deliberately dumb/presentational - it doesn't know whether it's rendering
// a project or a task. SearchCommand picks the icon and the navigation
// target per result type; this just lays the row out.
//
// `value` is an explicit, stable identifier (not derived from title text) -
// cmdk uses it to key keyboard highlighting/selection, and relying on its
// text-content fallback would break if a project and a task ever shared a
// name.
export function SearchResultItem({
  value,
  icon: Icon,
  title,
  description,
  onSelect,
}: SearchResultItemProps) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      aria-label={description ? `${title}. ${description}` : title}
      className="items-start gap-2.5 py-2"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{title}</span>
        {description ? (
          <span className="truncate text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
    </CommandItem>
  );
}
