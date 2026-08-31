import { Database, Radio, ShieldCheck, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
      className="scroll-mt-16 px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-muted p-8 sm:p-12">
        <div className="max-w-2xl">
          <h2
            id="engineering-heading"
            className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Built like a real product, not a prototype
          </h2>

          <p className="mt-3 text-muted-foreground">
            TeamOS runs on a modular monolith with a real multi-tenant PostgreSQL backend,
            not a mocked API.
          </p>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {engineeringPoints.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-sm">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
