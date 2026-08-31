import { Database, Radio, ShieldCheck, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SectionReveal } from "./section-reveal";

interface EngineeringPoint {
  icon: LucideIcon;
  label: string;
}

const engineeringPoints: EngineeringPoint[] = [
  { icon: Users, label: "Multi-tenant workspace isolation" },
  { icon: ShieldCheck, label: "Role-based access control" },
  { icon: Database, label: "PostgreSQL with Prisma" },
  { icon: Zap, label: "Redis-backed queues with BullMQ" },
  { icon: Radio, label: "Realtime updates over Socket.IO" },
];

export function EngineeringSection() {
  return (
    <section
      id="engineering"
      aria-labelledby="engineering-heading"
      className="scroll-mt-16 px-4 pt-10 pb-20 sm:px-6 sm:pt-12 sm:pb-24 lg:px-8"
    >
      <SectionReveal className="mx-auto max-w-6xl border-t border-border pt-6">
        <p className="text-sm font-medium text-muted-foreground">Engineering</p>

        <h2
          id="engineering-heading"
          className="mt-4 max-w-2xl font-heading text-xl font-medium tracking-tight text-balance sm:text-2xl"
        >
          Built like a real product, not a prototype
        </h2>

        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          TeamOS runs on a modular monolith with a real multi-tenant PostgreSQL backend,
          not a mocked API.
        </p>
      </SectionReveal>

      <SectionReveal>
        <ul className="mx-auto mt-12 grid max-w-6xl gap-x-8 gap-y-5 border-y border-border py-8 sm:grid-cols-2 lg:grid-cols-3">
          {engineeringPoints.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="group flex items-center gap-2.5 text-sm transition-transform duration-150 hover:translate-x-px"
            >
              <Icon
                className="size-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground"
                aria-hidden="true"
              />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </SectionReveal>
    </section>
  );
}
