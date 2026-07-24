import { BellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export function HeaderNotifications() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon-lg"
          variant="secondary"
          className="hidden sm:inline-flex"
          aria-label="Notifications"
        >
          <BellIcon className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>

        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <p className="text-sm font-medium text-foreground">No notifications yet.</p>

          <PopoverDescription>Notifications will appear here in the future.</PopoverDescription>
        </div>
      </PopoverContent>
    </Popover>
  );
}
