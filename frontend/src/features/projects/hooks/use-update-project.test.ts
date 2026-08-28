import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { createTestQueryClient } from "@/test/create-test-query-client";

import { updateProject } from "../api/projects.api";
import { useUpdateProject } from "./use-update-project";

vi.mock("../api/projects.api");
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockUpdateProject = vi.mocked(updateProject);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useUpdateProject", () => {
  beforeEach(() => {
    mockUpdateProject.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("does not toast on a rejected mutation - ProjectForm's inline error is the only surface", async () => {
    mockUpdateProject.mockRejectedValue({ type: "validation", message: "Project name already exists" });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useUpdateProject(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ projectId: "project-1", input: { name: "Renamed" } });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).not.toHaveBeenCalled();
  });
});
