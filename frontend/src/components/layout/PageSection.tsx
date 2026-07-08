import type { ReactNode } from "react";

interface PageSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function PageSection({ children, title, description }: PageSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      {title || description ? (
        <div className="flex flex-col gap-1">
          {title ? <h2 className="text-xl font-semibold tracking-tight">{title}</h2> : null}

          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
