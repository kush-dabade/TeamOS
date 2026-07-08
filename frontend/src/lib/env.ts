const { VITE_API_URL } = import.meta.env;

if (!VITE_API_URL) {
  throw new Error("VITE_API_URL is not defined.");
}

export const env = {
  apiUrl: VITE_API_URL,
} as const;
