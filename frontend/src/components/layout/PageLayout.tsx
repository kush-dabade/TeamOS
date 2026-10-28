import type { ReactNode } from "react";

interface PageLayoutProps {
  children: ReactNode;
}

// A plain container, not a <main>: every page using it renders inside the
// app shell, whose SidebarInset is already the page's one main landmark.
export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div
      className="
        flex min-w-0 flex-1 flex-col
        px-5
        pt-4
        pb-6
      "
    >
      {children}
    </div>
  );
}
