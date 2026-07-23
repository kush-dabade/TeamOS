import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ErrorStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function ErrorState({ icon: Icon, title, description, action }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>

      {action ? <div className="mt-2 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
