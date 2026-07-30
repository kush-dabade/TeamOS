import { Button } from "@/components/ui";

interface ListErrorStateProps {
  title: string;
  description: string;
  onRetry: () => void;
}

// Compact inline error state for a list/feed nested inside a card or
// popover (Comments, Attachments, Activity, Notifications). Deliberately
// smaller and plainer than the page-level `ErrorState` (no icon, no heading
// element, no gap-4 rhythm) - that component is sized for full-page/table
// error states, and forcing it into these tight card-sized contexts would
// look oversized and skip heading levels.
export function ListErrorState({ title, description, onRetry }: ListErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-1 py-4 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
