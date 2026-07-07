import type { PropsWithChildren } from "react";

type AppHeaderProps = PropsWithChildren;

export function AppHeader({ children }: AppHeaderProps) {
  return <header>{children}</header>;
}
