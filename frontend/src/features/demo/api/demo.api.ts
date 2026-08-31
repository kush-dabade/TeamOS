import { apiClient, type ApiSuccess } from "@/lib/api";

export interface DemoSession {
  expiresAt: string;
}

interface BackendDemoSession {
  expiresAt: string;
}

// POST /api/v1/demo/session - public, no auth required, no request body.
// The backend provisions a real isolated user/workspace and sets the
// session cookie directly on this response; axios's withCredentials
// (lib/api/client.ts) is what makes the browser keep it. Nothing about the
// new identity (id, email, token) is in the response body to read here -
// see backend/src/modules/demo/demo.controller.ts's own comment on why.
export async function createDemoSession(): Promise<DemoSession> {
  const response = await apiClient.post<ApiSuccess<BackendDemoSession>>("/demo/session");

  return { expiresAt: response.data.data.expiresAt };
}
