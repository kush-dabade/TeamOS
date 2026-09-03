import { motion, useReducedMotion } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

export function ProductPreviewSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="product"
      aria-labelledby="product-heading"
      className="scroll-mt-16 px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8 lg:pb-32"
    >
      {/* Visually silent — the hero flows directly into the screenshot with no
          separating heading, but the section keeps an accessible name for the
          navbar's "#product" anchor and for screen-reader landmark structure. */}
      <h2 id="product-heading" className="sr-only">
        The TeamOS dashboard
      </h2>

      {/* Deliberately wider than the max-w-6xl text column above it — the
          product screenshot is the one element on the page allowed to break
          the shared container width, so it reads as the strongest visual
          object after the hero headline rather than another content block. */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 32, scale: 0.92 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mx-auto max-w-7xl"
      >
        <picture>
          {/* Below sm, a genuine full-viewport portrait capture of the mobile
              app (390x844 @3x) is served instead of CSS-cropping the wide
              desktop image down to an unreadable strip - the container's
              aspect ratio matches this image's own 1170x2532 proportions, so
              object-cover has nothing to crop. */}
          <source media="(max-width: 639px)" srcSet="/images/marketing/dashboard-mobile.png" />
          <img
            src="/images/marketing/dashboard.png"
            srcSet="/images/marketing/dashboard.png 1x, /images/marketing/dashboard@2x.png 2x"
            alt="The TeamOS dashboard, showing a workspace's navigation, active projects, and in-progress tasks."
            width={1600}
            height={1000}
            fetchPriority="high"
            decoding="async"
            className="aspect-[1170/2532] w-full rounded-3xl border border-border object-cover shadow-sm sm:aspect-[1600/1000]"
          />
        </picture>
      </motion.div>
    </section>
  );
}
