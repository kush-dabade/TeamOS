import { formatDistanceToNow } from "date-fns";

export function formatRelativeDate(date: Date | string): string {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
  });
}