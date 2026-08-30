import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8"
    >
      <h1
        id="hero-heading"
        className="font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
      >
        A clearer way to run your team&apos;s work.
      </h1>

      <p className="mt-6 max-w-xl text-lg text-muted-foreground text-balance">
        TeamOS brings projects, tasks, sprints, comments, and activity into one workspace —
        so everyone can see what&apos;s happening and what&apos;s next.
      </p>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/try">Try TeamOS</Link>
        </Button>

        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    </section>
  );
}
