import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api";

import { fetchProjects } from "./projects.api";

vi.mock("@/lib/api", () => ({ apiClient: { get: vi.fn() } }));

function backendProject(id: string, taskCounts?: { total: number; completed: number }) {
  return {
    id,
    workspaceId: "workspace-1",
    ownerId: "user-1",
    name: id,
    slug: id,
    description: null,
    status: "ACTIVE",
    startDate: null,
    endDate: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...(taskCounts && { taskCounts }),
  };
}

// Regression (audit F-25): progress used to be computed from a task list
// capped at 100 per project.
describe("fetchProjects task counts", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("uses the server's counts, including projects with more than 100 tasks", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: [
          backendProject("big", { total: 150, completed: 30 }),
          backendProject("empty", { total: 0, completed: 0 }),
        ],
      },
    });

    const [big, empty] = await fetchProjects("workspace-1");

    expect(big).toMatchObject({ totalTaskCount: 150, completedTaskCount: 30, progressPercentage: 20 });
    expect(empty).toMatchObject({ totalTaskCount: 0, completedTaskCount: 0, progressPercentage: 0 });
  });

  it("reports zero counts when the response carries none", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { success: true, data: [backendProject("new")] },
    });

    const [project] = await fetchProjects("workspace-1");

    expect(project).toMatchObject({ totalTaskCount: 0, completedTaskCount: 0, progressPercentage: 0 });
  });
});
