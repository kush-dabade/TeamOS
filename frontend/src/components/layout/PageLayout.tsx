import type { ReactNode } from "react";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return <div className="flex flex-1 flex-col gap-8 p-6">{children}</div>;
}
