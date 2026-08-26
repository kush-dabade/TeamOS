import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

export const PROTECTED_CONTENT_TEXT = "Protected content";

interface PreservedFrom {
  pathname: string;
  search: string;
}

/**
 * Surfaces the current route's pathname and any `state.from` location a
 * guard preserved on redirect as data attributes a test can read directly.
 * Stands in for every redirect destination a guard in this app targets
 * (/login, /dashboard, /onboarding).
 */
function RouteProbe() {
  const location = useLocation();
  const from = (location.state as { from?: PreservedFrom } | null)?.from;

  return (
    <div
      data-testid="route-probe"
      data-pathname={location.pathname}
      data-from={from ? `${from.pathname}${from.search}` : ""}
    />
  );
}

interface RenderGuardOptions {
  initialEntries?: string[];
}

/**
 * Mounts a guard element inside a MemoryRouter with a protected index route
 * and probe routes for every redirect destination a guard uses. Calls
 * `cleanup()` itself before rendering: this repo's vitest config runs with
 * `globals: false`, so Testing Library's usual automatic
 * afterEach(cleanup) never registers (it looks for a bare global
 * `afterEach`, which doesn't exist here) - without this, a second render in
 * the same test, or the next test's render, would find both trees mounted.
 */
export function renderGuard(
  guard: ReactElement,
  { initialEntries = ["/"] }: RenderGuardOptions = {},
) {
  cleanup();

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        {/* path="*" (not the default unpathed layout route) so an arbitrary
            protected path like /dashboard/tasks still mounts the guard -
            React Router ranks the literal sibling routes below above this
            wildcard for their own exact paths regardless of order. */}
        <Route path="*" element={guard}>
          <Route path="*" element={<div>{PROTECTED_CONTENT_TEXT}</div>} />
        </Route>
        <Route path="/login" element={<RouteProbe />} />
        <Route path="/dashboard" element={<RouteProbe />} />
        <Route path="/onboarding" element={<RouteProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}
