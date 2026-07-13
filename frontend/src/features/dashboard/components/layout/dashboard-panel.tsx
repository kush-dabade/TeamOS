import type { PropsWithChildren, ReactNode } from "react";

import { Card } from "@/components/ui";

interface DashboardPanelProps extends PropsWithChildren {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function DashboardPanel({
  title,
  description,
  action,
  children,
}: DashboardPanelProps) {
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>

          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>

        {action}
      </div>

      <div className="flex-1">{children}</div>
    </Card>
  );
}