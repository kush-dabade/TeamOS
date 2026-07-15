import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1
          className="
            text-2xl
            font-semibold
            tracking-tight
            leading-none
          "
        >
          {title}
        </h1>

        {description ? (
          <p
            className="
              text-muted-foreground
              mt-1
              text-sm
              leading-5
            "
          >
            {description}
          </p>
        ) : null}
      </div>

      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}
