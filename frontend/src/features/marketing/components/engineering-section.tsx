import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

import { SectionReveal } from "./section-reveal";

const EASE = [0.16, 1, 0.3, 1] as const;
const ITEM_STAGGER = 0.05;

interface ArchitectureItem {
  number: string;
  title: string;
  description: string;
}

const foundation: ArchitectureItem[] = [
  {
    number: "01",
    title: "Authentication",
    description: "Real sign-in and session management through Better Auth.",
  },
  {
    number: "02",
    title: "Multi-tenant workspace isolation",
    description: "Every workspace-scoped resource stays within its workspace boundary.",
  },
  {
    number: "03",
    title: "Role-based access control",
    description: "Workspace roles — Owner, Admin, and Member — determine what each person can do.",
  },
];

const infrastructure: ArchitectureItem[] = [
  {
    number: "04",
    title: "PostgreSQL + Prisma",
    description: "Relational persistence and typed database access through Prisma.",
  },
  {
    number: "05",
    title: "Redis + BullMQ",
    description: "Background jobs stay decoupled from request handling.",
  },
  {
    number: "06",
    title: "Socket.IO",
    description: "Realtime updates support collaborative workflows.",
  },
];

function ArchitectureItemRow({ number, title, description }: ArchitectureItem) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={{
        hidden: shouldReduceMotion ? {} : { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
      }}
      className="border-t border-border py-8 first:border-t-0 first:pt-0"
    >
      <span className="text-lg tabular-nums text-muted-foreground sm:text-xl">{number}</span>

      <p className="mt-2 font-heading text-2xl font-medium tracking-tight text-balance sm:text-3xl">
        {title}
      </p>

      <p className="mt-2 max-w-sm text-base text-muted-foreground">{description}</p>
    </motion.div>
  );
}

export function EngineeringSection() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: shouldReduceMotion ? undefined : { staggerChildren: ITEM_STAGGER },
    },
  };

  return (
    <section
      id="engineering"
      aria-labelledby="engineering-heading"
      className="scroll-mt-16 px-4 pt-24 pb-24 sm:px-6 sm:pt-28 sm:pb-28 lg:px-8 lg:pt-28 lg:pb-32"
    >
      <SectionReveal className="mx-auto max-w-6xl border-t border-border pt-6">
        <p className="text-sm font-medium text-muted-foreground">Engineering</p>

        <h2
          id="engineering-heading"
          className="mt-4 max-w-2xl font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl"
        >
          Built like a real product, not a prototype.
        </h2>

        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          TeamOS runs on a modular monolith with a real multi-tenant PostgreSQL backend, not a
          mocked API.
        </p>
      </SectionReveal>

      {/* Two architectural groups, divided by a rule rather than a card —
          Foundation (the tenancy/security model) and Infrastructure (the
          technology stack that implements it) are a real distinction, not
          a layout device. No screenshot, no icons: typography and the
          dividing rule carry the section, in deliberate contrast to
          Capabilities' image-anchored composition. */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={containerVariants}
        className="mx-auto mt-10 max-w-6xl border-t border-border pt-10 sm:mt-12"
      >
        <div className="grid gap-x-16 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-[0.12em] sm:text-base">
              Foundation
            </h3>

            <div className="mt-8">
              {foundation.map((item) => (
                <ArchitectureItemRow key={item.number} {...item} />
              ))}
            </div>
          </div>

          <div className="mt-12 lg:mt-0 lg:border-l lg:border-border lg:pl-10 xl:pl-16">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-[0.12em] sm:text-base">
              Infrastructure
            </h3>

            <div className="mt-8">
              {infrastructure.map((item) => (
                <ArchitectureItemRow key={item.number} {...item} />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
