import { BellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function HeaderNotifications() {
  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className="size-9 rounded-lg"
      aria-label="Notifications"
    >
      <BellIcon className="size-4" />
    </Button>
  );
}