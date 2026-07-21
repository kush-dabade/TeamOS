import axios from "axios";

import { env } from "../env";
import { normalizeError } from "./error";

export const apiClient = axios.create({
  baseURL: env.apiUrl,
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
  (error) => Promise.reject(normalizeError(error)),
);
