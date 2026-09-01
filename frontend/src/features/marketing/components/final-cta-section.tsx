import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { SectionReveal } from "./section-reveal";

import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="px-4 pt-24 pb-28 sm:px-6 sm:pt-28 sm:pb-32 lg:px-8 lg:pt-32 lg:pb-36"
    >
      <SectionReveal className="mx-auto max-w-3xl border-t border-border pt-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">Get started</p>

        <h2
          id="final-cta-heading"
          className="mt-4 font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl"
        >
          See it for yourself.
        </h2>

        <p className="mt-5 text-base text-muted-foreground sm:text-lg">
          Explore a live TeamOS workspace — no account required.
        </p>

        <div className="mt-10">
          {/* The only CTA here — "Sign in" already lives in the navbar for
              the whole scroll, so repeating it as a second action at the
              page's final, most decisive moment would just dilute it. */}
          <Button
            asChild
            size="lg"
            className="group transition-transform hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <Link to="/try">
              Try TeamOS
              <ArrowRight
                aria-hidden="true"
                className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              />
            </Link>
          </Button>
        </div>
      </SectionReveal>
    </section>
  );
}
