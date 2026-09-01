import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

import { SectionReveal } from "./section-reveal";

const EASE = [0.16, 1, 0.3, 1] as const;
const SUPPORTING_COLUMNS = 2;
const SUPPORTING_STAGGER = 0.05;

interface SupportingCapability {
  number: string;
  title: string;
  description: string;
}

const supportingCapabilities: SupportingCapability[] = [
  {
    number: "02",
    title: "Tasks",
    description: "Track status, priority, assignees, and due dates on every task.",
  },
  {
    number: "03",
    title: "Sprints",
    description: "Plan focused sprints and move tasks through them as work progresses.",
  },
  {
    number: "04",
    title: "Activity feed",
    description: "Every change is recorded, so a project's history is always visible.",
  },
  {
    number: "05",
    title: "Notifications",
    description: "Stay on top of assignments and updates as they happen.",
  },
  {
    number: "06",
    title: "Search",
    description: "Find projects, tasks, and comments across the workspace instantly.",
  },
];

// Grouped into rows so a rule can separate rows without also cutting
// between the two columns of the same row (see sm:divide-y-0 below).
const supportingRows: SupportingCapability[][] = Array.from(
  { length: Math.ceil(supportingCapabilities.length / SUPPORTING_COLUMNS) },
  (_, rowIndex) =>
    supportingCapabilities.slice(
      rowIndex * SUPPORTING_COLUMNS,
      rowIndex * SUPPORTING_COLUMNS + SUPPORTING_COLUMNS,
    ),
);

export function CapabilitiesSection() {
  const shouldReduceMotion = useReducedMotion();

  const supportingContainerVariants: Variants = {
    hidden: {},
    visible: {
      transition: shouldReduceMotion ? undefined : { staggerChildren: SUPPORTING_STAGGER },
    },
  };

  const supportingItemVariants: Variants = {
    hidden: shouldReduceMotion ? {} : { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  };

  return (
    <section
      id="capabilities"
      aria-labelledby="capabilities-heading"
      className="px-4 pt-24 pb-20 sm:px-6 sm:pt-28 sm:pb-24 lg:px-8 lg:pt-32 lg:pb-28"
    >
      <SectionReveal className="mx-auto max-w-6xl border-t border-border pt-6">
        <p className="text-sm font-medium text-muted-foreground">Capabilities</p>

        <h2
          id="capabilities-heading"
          className="mt-4 max-w-2xl font-heading text-2xl font-medium tracking-tight text-balance sm:text-3xl"
        >
          Everything a team needs to move work forward
        </h2>
      </SectionReveal>

      {/* Focal: Projects is the one dominant capability — paired with real
          evidence (a live capture of the Projects table) instead of another
          icon+description row, so it reads as the section's centerpiece
          rather than the first of six equal cards. */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mx-auto mt-16 max-w-6xl sm:mt-20"
      >
        <div className="lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-12">
          <div className="lg:col-span-5">
            <span className="font-heading text-sm font-medium tabular-nums text-muted-foreground">
              01
            </span>

            <h3 className="mt-3 font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl">
              Projects
            </h3>

            <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
              Organize work into projects with status, ownership, and progress tracking.
            </p>
          </div>

          <div className="mt-10 lg:col-span-7 lg:mt-0">
            <picture>
              {/* Five columns (Project/Status/Progress/Tasks/Updated) shrink past
                  legibility below sm, so a tighter real crop (Project + Status
                  only, same three rows) is served instead of scaling the full
                  desktop table down to an unreadable strip. */}
              <source media="(max-width: 639px)" srcSet="/images/marketing/projects-mobile.png" />
              <img
                src="/images/marketing/projects.png"
                alt="The TeamOS projects list, showing three projects with their status, progress, and task counts."
                width={1976}
                height={580}
                loading="lazy"
                decoding="async"
                className="aspect-[896/300] w-full rounded-3xl border border-border object-cover shadow-sm sm:aspect-[1976/580]"
              />
            </picture>
          </div>
        </div>
      </motion.div>

      {/* Supporting: deliberately quieter — no screenshots, no icons.
          Typography scale and the shared 01–06 numbering carry the
          hierarchy instead of a second visual anchor competing with
          Projects. */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={supportingContainerVariants}
        className="mx-auto mt-20 max-w-6xl sm:mt-24"
      >
        {supportingRows.map((row) => (
          <div
            key={row.map(({ title }) => title).join("-")}
            className="grid gap-x-12 divide-y divide-border border-t border-border first:border-t-0 sm:grid-cols-2 sm:divide-y-0"
          >
            {row.map(({ number, title, description }) => (
              <motion.div
                key={title}
                variants={supportingItemVariants}
                className="group py-10 transition-transform duration-150 hover:translate-x-px motion-reduce:transition-none motion-reduce:hover:translate-x-0"
              >
                <span className="font-heading text-sm font-medium tabular-nums text-muted-foreground transition-colors duration-150 group-hover:text-foreground">
                  {number}
                </span>

                <h3 className="mt-2 font-heading text-xl font-medium tracking-tight text-foreground sm:text-2xl">
                  {title}
                </h3>

                <p className="mt-2 max-w-sm text-base text-muted-foreground">{description}</p>
              </motion.div>
            ))}
          </div>
        ))}
      </motion.div>
    </section>
  );
}
