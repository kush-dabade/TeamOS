  import axios from "axios";

  import { env } from "./env";

  export const apiClient = axios.create({
    baseURL: env.apiUrl,
    timeout: 10_000,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
    },
  });
