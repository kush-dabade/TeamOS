import { Layers3 } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <Layers3 className="size-4" aria-hidden="true" />
          <span className="font-medium text-foreground">TeamOS</span>
        </div>

        <a
          href="https://github.com/kush-dabade/TeamOS"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub (opens in a new tab)"
          className="rounded-sm underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View source on GitHub
        </a>
      </div>
    </footer>
  );
}
