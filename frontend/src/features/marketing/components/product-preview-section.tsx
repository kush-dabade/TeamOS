import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

export function ProductPreviewSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.9", "start 0.4"],
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);

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

      <motion.div
        ref={containerRef}
        style={shouldReduceMotion ? undefined : { opacity, scale, y }}
        className="mx-auto max-w-6xl"
      >
        <img
          src="/images/marketing/dashboard.png"
          alt="The TeamOS dashboard, showing a workspace's active projects and the tasks that need attention."
          width={1419}
          height={513}
          fetchPriority="high"
          decoding="async"
          className="w-full rounded-3xl border border-border shadow-sm"
        />
      </motion.div>
    </section>
  );
}
