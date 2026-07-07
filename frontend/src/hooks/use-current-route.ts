import { useLocation } from "react-router-dom";

import { appRoutesConfig } from "@/config/routes";

export function useCurrentRoute() {
  const { pathname } = useLocation();

  return (
    appRoutesConfig.find(
      (route) => pathname === route.path || pathname.startsWith(`${route.path}/`),
    ) ?? null
  );
}
