import type { ReactNode } from "react";

interface PageErrorProps {
  children: ReactNode;
}

export function PageError({ children }: PageErrorProps) {
  return <div className="flex flex-1 items-center justify-center px-5 py-12">{children}</div>;
}
