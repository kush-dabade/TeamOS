import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section aria-labelledby="final-cta-heading" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-10 text-center sm:p-16">
        <h2
          id="final-cta-heading"
          className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          See it for yourself.
        </h2>

        <p className="mt-3 text-muted-foreground">
          Explore a live TeamOS workspace — no account required.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/try">Try TeamOS</Link>
          </Button>

          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
