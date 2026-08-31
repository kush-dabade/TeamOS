import { ArrowUpRight, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const DOCS_URL = "https://github.com/kush-dabade/TeamOS/tree/main/docs";

export function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 lg:px-8">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-sm transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Layers3 className="size-5 text-foreground" aria-hidden="true" />
          <span className="text-base font-bold tracking-tight">TeamOS</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a
            href="#product"
            className="rounded-sm transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Product
          </a>

          <a
            href="#engineering"
            className="rounded-sm transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Engineering
          </a>

          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Docs (opens in a new tab)"
            className="group inline-flex items-center gap-1 rounded-sm transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Docs
            <ArrowUpRight
              aria-hidden="true"
              className="size-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>

          <Button asChild>
            <Link to="/try">Try TeamOS</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
