import { format } from "date-fns";

export function formatDate(
  date: Date | string,
  pattern = "MMM d, yyyy",
): string {
  return format(new Date(date), pattern);
}