import type { ReactNode } from "react";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <main
      className="
        flex min-w-0 flex-1 flex-col
        px-5
        pt-4
        pb-6
      "
    >
      {children}
    </main>
  );
}
