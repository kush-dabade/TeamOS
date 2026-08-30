import { Layers3 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Link to="/" className="inline-flex items-center gap-2">
          <Layers3 className="size-5 text-foreground" aria-hidden="true" />
          <span className="text-base font-bold tracking-tight">TeamOS</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#product" className="hover:text-foreground">
            Product
          </a>
          <a href="#engineering" className="hover:text-foreground">
            Engineering
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
