import { useCurrentRoute } from "@/hooks";

export function Breadcrumbs() {
  const route = useCurrentRoute();

  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground flex items-center text-sm">
      <span className="font-medium">{route?.title ?? "TeamOS"}</span>
    </nav>
  );
}
