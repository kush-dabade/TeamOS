import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROTECTED_CONTENT_TEXT, renderGuard } from "@/test/render-guard";

import { useWorkspaceResolution } from "../hooks/use-workspace-resolution";
import { WorkspaceGuard } from "./workspace-guard";

vi.mock("../hooks/use-workspace-resolution");

const mockUseWorkspaceResolution = vi.mocked(useWorkspaceResolution);

type WorkspaceResolutionState = ReturnType<typeof useWorkspaceResolution>;

function workspaceResolutionState(
  overrides: Partial<WorkspaceResolutionState>,
): WorkspaceResolutionState {
  return {
    workspaces: [],
    activeWorkspace: null,
    activeWorkspaceId: null,
    isLoading: false,
    isError: false,
    error: null,
    switchWorkspace: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("WorkspaceGuard", () => {
  beforeEach(() => {
    mockUseWorkspaceResolution.mockReset();
  });

  it("renders a loading state while workspaces are resolving", () => {
    mockUseWorkspaceResolution.mockReturnValue(workspaceResolutionState({ isLoading: true }));

    renderGuard(<WorkspaceGuard />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders an error state and retries via refetch when workspace resolution fails", () => {
    const refetch = vi.fn();
    mockUseWorkspaceResolution.mockReturnValue(
      workspaceResolutionState({ isError: true, refetch }),
    );

    renderGuard(<WorkspaceGuard />);

    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("redirects to /onboarding when the user has no workspaces", () => {
    mockUseWorkspaceResolution.mockReturnValue(workspaceResolutionState({ workspaces: [] }));

    renderGuard(<WorkspaceGuard />);

    const probe = screen.getByTestId("route-probe");

    expect(probe.dataset.pathname).toBe("/onboarding");
  });

  it("renders the protected content when the user has at least one workspace", () => {
    mockUseWorkspaceResolution.mockReturnValue(
      workspaceResolutionState({
        workspaces: [
          {
            id: "workspace-1",
            name: "Acme",
            slug: "acme",
            role: "OWNER",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    renderGuard(<WorkspaceGuard />);

    expect(screen.getByText(PROTECTED_CONTENT_TEXT)).toBeInTheDocument();
  });
});
