import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function HeaderSearch() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Search"
          className="hidden h-9 w-80 justify-between rounded-lg border border-transparent bg-muted/40 px-3 text-muted-foreground transition-colors hover:bg-muted/70 hover:border-border/40 md:flex"
        >
          <div className="flex items-center gap-2">
            <SearchIcon className="size-4 opacity-70" />

            <span className="text-sm">Search...</span>
          </div>

          <kbd className="pointer-events-none rounded border border-border/30 bg-muted px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
            Ctrl + K
          </kbd>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Global Search</DialogTitle>

          <DialogDescription>
            Global Search will be implemented in a future roadmap phase. You&apos;ll be able to
            jump to projects, tasks, and people from anywhere in TeamOS.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
