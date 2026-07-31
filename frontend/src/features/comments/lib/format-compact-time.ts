import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
} from "date-fns";

import { formatDate } from "@/utils";

// Comments read as a running conversation, so timestamps here are terser
// than formatRelativeDate's "18 minutes ago" (used everywhere else in the
// app) - "18m" reads as metadata rather than competing with the author name.
export function formatCompactTime(date: Date | string): string {
  const value = new Date(date);
  const now = new Date();

  const seconds = differenceInSeconds(now, value);
  if (seconds < 60) {
    return "now";
  }

  const minutes = differenceInMinutes(now, value);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = differenceInHours(now, value);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = differenceInCalendarDays(now, value);
  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days}d`;
  }

  if (value.getFullYear() !== now.getFullYear()) {
    return formatDate(value, "MMM d, yyyy");
  }

  return formatDate(value, "MMM d");
}
