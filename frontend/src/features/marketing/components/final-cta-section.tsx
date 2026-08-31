import { Link } from "react-router-dom";

import { SectionReveal } from "./section-reveal";

import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section aria-labelledby="final-cta-heading" className="px-4 pt-12 pb-24 sm:px-6 sm:pt-16 lg:px-8">
      <SectionReveal className="mx-auto max-w-3xl border-t border-border pt-16 text-center">
        <h2
          id="final-cta-heading"
          className="font-heading text-2xl font-medium tracking-tight text-balance sm:text-3xl"
        >
          See it for yourself.
        </h2>

        <p className="mt-3 text-muted-foreground">
          Explore a live TeamOS workspace — no account required.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full transition-transform hover:-translate-y-px sm:w-auto">
            <Link to="/try">Try TeamOS</Link>
          </Button>

          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </SectionReveal>
    </section>
  );
}
