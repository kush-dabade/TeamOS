import type { PropsWithChildren, ReactNode } from "react";

import { Card } from "@/components/ui";

interface DashboardPanelProps extends PropsWithChildren {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function DashboardPanel({ title, description, action, children }: DashboardPanelProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <header
        className={["border-border border-b px-4", description ? "py-3" : "py-2.5"].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold leading-none tracking-tight">{title}</h2>

            {description ? (
              <p className="text-muted-foreground mt-0.5 text-xs leading-5">{description}</p>
            ) : null}
          </div>

          {action ? <div className="flex shrink-0 items-start">{action}</div> : null}
        </div>
      </header>

      <section className="flex flex-1 flex-col px-4 py-2">{children}</section>
    </Card>
  );
}
