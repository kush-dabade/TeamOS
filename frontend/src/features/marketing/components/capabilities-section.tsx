import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

import { SectionReveal } from "./section-reveal";

const EASE = [0.16, 1, 0.3, 1] as const;
const CLOSING_STAGGER = 0.05;

interface FeatureStory {
  number: string;
  title: string;
  description: string;
  imageSrc: string;
  imageMobileSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  /** Literal Tailwind classes — must stay literal so the build's static scanner finds them. */
  imageAspectClassName: string;
  /** Image on the left, text on the right at lg+. */
  reverse?: boolean;
}

const featureStories: FeatureStory[] = [
  {
    number: "01",
    title: "Projects",
    description: "Organize work into projects with status, ownership, and progress tracking.",
    imageSrc: "/images/marketing/projects.png",
    imageMobileSrc: "/images/marketing/projects-mobile.png",
    imageAlt: "The TeamOS projects list, showing three projects with their status, progress, and task counts.",
    imageWidth: 1976,
    imageHeight: 580,
    imageAspectClassName: "aspect-[896/300] sm:aspect-[1976/580]",
  },
  {
    number: "02",
    title: "Tasks",
    description: "Track status, priority, assignees, and due dates on every task.",
    imageSrc: "/images/marketing/tasks.png",
    imageMobileSrc: "/images/marketing/tasks-mobile.png",
    imageAlt: "The TeamOS task list, showing real tasks with their status, priority, assignee, and due date.",
    imageWidth: 1976,
    imageHeight: 1398,
    imageAspectClassName: "aspect-[750/700] sm:aspect-[1976/1398]",
    reverse: true,
  },
  {
    number: "03",
    title: "Search",
    description: "Find projects, tasks, and comments across the workspace instantly.",
    imageSrc: "/images/marketing/search.png",
    imageMobileSrc: "/images/marketing/search-mobile.png",
    imageAlt: "The TeamOS command palette searching for “launch,” returning matching projects and tasks.",
    imageWidth: 1600,
    imageHeight: 960,
    imageAspectClassName: "aspect-[1164/580] sm:aspect-[1600/960]",
  },
];

interface ClosingCapability {
  title: string;
  description: string;
}

const closingCapabilities: ClosingCapability[] = [
  {
    title: "Sprints",
    description: "Plan focused sprints and move tasks through them as work progresses.",
  },
  {
    title: "Activity feed",
    description: "Every change is recorded, so a project's history is always visible.",
  },
  {
    title: "Notifications",
    description: "Stay on top of assignments and updates as they happen.",
  },
];

function FeatureRow({ story }: { story: FeatureStory }) {
  const shouldReduceMotion = useReducedMotion();
  const {
    number,
    title,
    description,
    imageSrc,
    imageMobileSrc,
    imageAlt,
    imageWidth,
    imageHeight,
    imageAspectClassName,
    reverse,
  } = story;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12"
    >
      <div className={`lg:col-span-5 ${reverse ? "lg:order-2" : ""}`}>
        <span className="font-heading text-sm font-medium tabular-nums text-muted-foreground">
          {number}
        </span>

        <h3 className="mt-3 font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          {title}
        </h3>

        <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">{description}</p>
      </div>

      <div className={`mt-10 lg:col-span-7 lg:mt-0 ${reverse ? "lg:order-1" : ""}`}>
        <picture>
          <source media="(max-width: 639px)" srcSet={imageMobileSrc} />
          <img
            src={imageSrc}
            alt={imageAlt}
            width={imageWidth}
            height={imageHeight}
            decoding="async"
            className={`w-full rounded-3xl border border-border object-cover shadow-sm ${imageAspectClassName}`}
          />
        </picture>
      </div>
    </motion.div>
  );
}

export function CapabilitiesSection() {
  const shouldReduceMotion = useReducedMotion();

  const closingContainerVariants: Variants = {
    hidden: {},
    visible: {
      transition: shouldReduceMotion ? undefined : { staggerChildren: CLOSING_STAGGER },
    },
  };

  const closingItemVariants: Variants = {
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

      {/* Three product stories — Projects, Tasks, Search — each paired with
          a real screenshot, alternating sides for rhythm. Deliberately not
          the Product Preview treatment a second time: these stay contained
          within the text column's max-w-6xl rather than breaking out, and
          items-start (not items-center) so a short row never leaves dead
          space under a tall one. */}
      <div className="mx-auto mt-14 max-w-6xl space-y-20 sm:mt-16 sm:space-y-24 lg:space-y-28">
        {featureStories.map((story) => (
          <FeatureRow key={story.title} story={story} />
        ))}
      </div>

      {/* Closing trio: quieter by design — no numerals, no screenshots, no
          per-item rules. A single shared top rule introduces it as the
          supporting layer after the three major stories above. */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={closingContainerVariants}
        className="mx-auto mt-20 max-w-6xl border-t border-border pt-12 sm:mt-24 sm:pt-14"
      >
        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-3">
          {closingCapabilities.map(({ title, description }) => (
            <motion.div key={title} variants={closingItemVariants}>
              <h3 className="font-heading text-xl font-medium tracking-tight text-foreground sm:text-2xl">
                {title}
              </h3>

              <p className="mt-2 text-base text-muted-foreground">{description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
