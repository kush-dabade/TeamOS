import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/create-test-query-client";
import { activityKeys } from "@/features/activity/lib/activity-keys";
import { fetchWorkspaceActivities } from "@/features/activity/api/activity.api";
import { useActiveWorkspace } from "@/features/workspaces/hooks/use-active-workspace";

import { useRecentActivity } from "./use-recent-activity";

vi.mock("@/features/activity/api/activity.api");
vi.mock("@/features/workspaces/hooks/use-active-workspace");

const mockFetchWorkspaceActivities = vi.mocked(fetchWorkspaceActivities);
const mockUseActiveWorkspace = vi.mocked(useActiveWorkspace);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useRecentActivity", () => {
  beforeEach(() => {
    mockFetchWorkspaceActivities.mockReset();
    mockUseActiveWorkspace.mockReset();
  });

  it("fetches via the canonical activity API with no entity filter and caches under the canonical workspace-feed key", async () => {
    mockUseActiveWorkspace.mockReturnValue({
      workspace: null,
      workspaceId: "workspace-1",
      workspaces: [],
      switchWorkspace: vi.fn(),
    });
    mockFetchWorkspaceActivities.mockResolvedValue({
      activities: [],
      pagination: { page: 1, limit: 6, total: 0, pages: 0 },
    });

    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useRecentActivity(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchWorkspaceActivities).toHaveBeenCalledWith("workspace-1", { limit: 6 });
    // No entityType/entityId - the unscoped, workspace-wide call - not the
    // narrower per-entity form the canonical API also supports.
    expect(mockFetchWorkspaceActivities).toHaveBeenCalledWith(
      "workspace-1",
      expect.not.objectContaining({ entityType: expect.anything() }),
    );

    expect(queryClient.getQueryData(activityKeys.workspaceFeed("workspace-1"))).toEqual([]);
  });

  it("is disabled and does not fetch when there is no active workspace", () => {
    mockUseActiveWorkspace.mockReturnValue({
      workspace: null,
      workspaceId: null,
      workspaces: [],
      switchWorkspace: vi.fn(),
    });

    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useRecentActivity(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(mockFetchWorkspaceActivities).not.toHaveBeenCalled();
  });
});
