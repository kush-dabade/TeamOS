import { useCurrentRoute } from "@/hooks/use-current-route";

export function HeaderTitle() {
  const route = useCurrentRoute();

  return <h1 className="text-lg font-semibold tracking-tight">{route?.title ?? "TeamOS"}</h1>;
}
