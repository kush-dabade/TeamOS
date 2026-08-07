import axios from "axios";

import { env } from "../env";
import { normalizeError } from "./error";

export const apiClient = axios.create({
  baseURL: `${env.apiUrl}/api/v1`,
  // Default for typical JSON requests; slower calls (e.g. file uploads) should
  // override this per-request via axios config rather than raising it globally.
  timeout: 10_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const appError = normalizeError(error);

    // A 401 here means the session ended after the request was already
    // allowed to fire (expired/revoked mid-session) - login/register never
    // go through apiClient (they use authClient directly), and the one
    // public page that does, InvitationPage, only calls apiClient for the
    // no-auth preview endpoint, so this can't misfire on a legitimate
    // logged-out flow. Hard redirect (not a SPA navigate) so the QueryClient
    // cache and Better Auth's session store both reset along with it -
    // mirrors RouteErrorBoundary's existing use of window.location for
    // "something is fundamentally wrong, start over."
    //
    // The pathname check is future-proofing, not a live bug: nothing on
    // /login currently calls apiClient (login/register go through authClient
    // instead), so this redirect can't fire there today. It guards against a
    // future change quietly adding an apiClient call to the login page and
    // reintroducing a redirect loop.
    if (appError.type === "unauthorized" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }

    return Promise.reject(appError);
  },
);
