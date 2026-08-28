import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { createTestQueryClient } from "@/test/create-test-query-client";

import { createProject } from "../api/projects.api";
import { useCreateProject } from "./use-create-project";

vi.mock("../api/projects.api");
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockCreateProject = vi.mocked(createProject);

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useCreateProject", () => {
  beforeEach(() => {
    mockCreateProject.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("does not toast on a rejected mutation - ProjectForm's inline error is the only surface", async () => {
    mockCreateProject.mockRejectedValue({ type: "validation", message: "Project name already exists" });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useCreateProject("workspace-1"), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ ownerId: "user-1", name: "Website Redesign" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).not.toHaveBeenCalled();
  });
});
