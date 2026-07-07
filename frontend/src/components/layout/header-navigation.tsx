import { Breadcrumbs } from "./breadcrumbs";
import { HeaderTitle } from "./header-title";

export function HeaderNavigation() {
  return (
    <div className="flex min-w-0 flex-col">
      <Breadcrumbs />

      <HeaderTitle />
    </div>
  );
}
