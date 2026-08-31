import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="hero-heading"
      className="px-4 pt-24 pb-10 sm:px-6 sm:pt-32 sm:pb-14 lg:px-8 lg:pt-40 lg:pb-16"
    >
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-6xl"
      >
        <h1
          id="hero-heading"
          className="font-heading text-5xl leading-[0.92] tracking-tight text-balance sm:text-7xl lg:text-8xl"
        >
          <span className="block font-light text-muted-foreground">A clearer way to run</span>
          <span className="block font-semibold text-foreground">your team&apos;s work.</span>
        </h1>

        <p className="mt-8 max-w-lg text-lg text-muted-foreground text-balance">
          TeamOS brings projects, tasks, sprints, comments, and activity into one workspace —
          so everyone can see what&apos;s happening and what&apos;s next.
        </p>

        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/try">Try TeamOS</Link>
          </Button>

          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
