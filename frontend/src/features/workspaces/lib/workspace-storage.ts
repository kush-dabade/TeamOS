const ACTIVE_WORKSPACE_STORAGE_KEY = "teamos-active-workspace-id";

export function getStoredActiveWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveWorkspaceId(workspaceId: string): void {
  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
  } catch {
    // Storage unavailable (e.g. Safari private mode) — selection just won't persist.
  }
}
