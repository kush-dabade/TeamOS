import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import type { AppError } from "@/lib/api";

import { useWorkspaceList } from "../hooks/use-workspace-list";
import { getStoredActiveWorkspaceId, setStoredActiveWorkspaceId } from "../lib/workspace-storage";
import type { Workspace } from "../types";

export interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  isLoading: boolean;
  isError: boolean;
  error: AppError | null;
  switchWorkspace: (workspaceId: string) => void;
  refetch: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

/**
 * Owns workspace-list loading and active-workspace resolution/persistence.
 * Local Storage only ever touched here — everything else reads/writes the
 * active workspace through context.
 */
export function WorkspaceProvider({ children }: PropsWithChildren) {
  // The raw selection: whatever was last read from storage, or whatever the
  // user last explicitly switched to. This is NOT necessarily a workspace
  // the user can still access — the fetched list below is the only source of
  // truth for validity, so this value is reconciled, never trusted outright.
  const [storedWorkspaceId, setStoredWorkspaceId] = useState<string | null>(
    getStoredActiveWorkspaceId,
  );

  const workspacesQuery = useWorkspaceList();

  const workspaces = useMemo(() => workspacesQuery.data ?? [], [workspacesQuery.data]);

  // --- Reconciliation -------------------------------------------------
  // The active workspace is DERIVED, not stored, so it can never drift out
  // of sync with the fetched list. `activeWorkspaceId` is recomputed from
  // (workspaces, storedWorkspaceId) on every render:
  //
  //   1. Zero workspaces               -> null (WorkspaceGuard redirects to onboarding)
  //   2. storedWorkspaceId is in list  -> use it (the common "returning user" case)
  //   3. storedWorkspaceId is missing
  //      or points at a workspace the
  //      user no longer has            -> fall back to workspaces[0]
  //
  // Earlier iteration of this provider ran this same logic inside a
  // useEffect and called setState to "correct" invalid IDs — that causes an
  // extra render pass and trips react-hooks/set-state-in-effect. Deriving it
  // during render instead means there's nothing to correct: the exposed
  // value is always already right, on the very first render that has data.
  const activeWorkspaceId = useMemo(() => {
    if (workspaces.length === 0) {
      return null;
    }

    const storedWorkspaceIsValid = workspaces.some(
      (workspace) => workspace.id === storedWorkspaceId,
    );

    return storedWorkspaceIsValid ? storedWorkspaceId : workspaces[0].id;
  }, [workspaces, storedWorkspaceId]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  // --- Self-heal persistence -------------------------------------------
  // The derivation above never writes to storage — it just tolerates a bad
  // `storedWorkspaceId` on every render. This effect is what actually fixes
  // storage, exactly once, the first time the resolved ID disagrees with
  // what's on disk (case 1 or 3 above). It's a plain side effect syncing an
  // external system (localStorage) from already-resolved render state, not
  // a state correction, so it doesn't trigger a second render pass the way
  // a `setState` here would.
  useEffect(() => {
    if (activeWorkspaceId && activeWorkspaceId !== storedWorkspaceId) {
      setStoredActiveWorkspaceId(activeWorkspaceId);
    }
  }, [activeWorkspaceId, storedWorkspaceId]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setStoredWorkspaceId(workspaceId);
    setStoredActiveWorkspaceId(workspaceId);
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      isLoading: workspacesQuery.isPending,
      isError: workspacesQuery.isError,
      error: workspacesQuery.error ?? null,
      switchWorkspace,
      refetch: () => void workspacesQuery.refetch(),
    }),
    [
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      workspacesQuery.isPending,
      workspacesQuery.isError,
      workspacesQuery.error,
      workspacesQuery.refetch,
      switchWorkspace,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
