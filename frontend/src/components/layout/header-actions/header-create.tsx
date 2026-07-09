import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function HeaderCreate() {
  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className="size-9 rounded-lg"
      aria-label="Create"
    >
      <PlusIcon className="size-4" />
    </Button>
  );
}
