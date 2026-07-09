import { HeaderCreate } from "./header-create";
import { HeaderNotifications } from "./header-notifications";
import { HeaderSearch } from "./header-search";

export function HeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <HeaderSearch />
      <HeaderCreate />
      <HeaderNotifications />
    </div>
  );
}