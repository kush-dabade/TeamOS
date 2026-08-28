import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/create-test-query-client";

import type { ProjectListItem, ProjectPreviewData } from "../../types";

import { ProjectPreviewPanel } from "./ProjectPreviewPanel";

// Radix's DropdownMenu/Sheet/AlertDialog primitives read pointer-capture/
// scroll/resize APIs jsdom doesn't implement, and throw "not implemented"
// without them - same stub used by TaskForm.test.tsx and ProjectForm.test.tsx
// for their own Radix Select usage.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (typeof window.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

// This repo's vitest config runs with `globals: false`, so Testing Library's
// automatic afterEach(cleanup) never registers - clean up explicitly before
// every render instead (see TaskForm.test.tsx for the same note).
beforeEach(() => {
  cleanup();
  mockUseWorkspaceMembers.mockReset();
  mockUseWorkspaceMembers.mockReturnValue({ data: [], isLoading: false });
});

// Controllable per test: most tests leave actorRole undefined, which keeps
// canTransferOwnership false regardless of the members list, so a static
// empty default is enough for those. The ownership-transfer tests below
// override this to supply an eligible member.
const mockUseWorkspaceMembers = vi.fn();
vi.mock("@/features/workspaces", () => ({
  useWorkspaceMembers: (...args: unknown[]) => mockUseWorkspaceMembers(...args),
}));

function buildProject(overrides: Partial<ProjectListItem["project"]> = {}): ProjectListItem {
  return {
    project: {
      id: "project-1",
      slug: "website-redesign",
      name: "Website Redesign",
      description: null,
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    },
    completedTaskCount: 3,
    totalTaskCount: 10,
    progressPercentage: 30,
  };
}

interface RenderPanelOptions {
  project?: Partial<ProjectListItem["project"]>;
  previewData?: ProjectPreviewData | null;
  actorRole?: "OWNER" | "ADMIN" | "MEMBER";
}

function renderPanel({ project = {}, previewData = null, actorRole }: RenderPanelOptions = {}) {
  const onEdit = vi.fn();
  const onArchive = vi.fn();
  const onRestore = vi.fn();
  const onOpenProject = vi.fn();

  // TransferProjectOwnershipDialog (mounted whenever canTransferOwnership is
  // true) calls useTransferProjectOwnership, which needs a real
  // QueryClientProvider in the tree even though its mutation is never
  // triggered by these tests.
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProjectPreviewPanel
        project={buildProject(project)}
        previewData={previewData}
        isPreviewLoading={false}
        isArchiving={false}
        isRestoring={false}
        workspaceId="workspace-1"
        actorRole={actorRole}
        open={true}
        onClose={vi.fn()}
        onCloseAutoFocus={vi.fn()}
        onOpenProject={onOpenProject}
        onEdit={onEdit}
        onArchive={onArchive}
        onRestore={onRestore}
      />
    </QueryClientProvider>,
  );

  return { onEdit, onArchive, onRestore, onOpenProject };
}

function openActionsMenu() {
  const trigger = screen.getByRole("button", { name: "Project actions" });
  // Radix's DropdownMenuTrigger opens on pointerdown, not click - a plain
  // fireEvent.click never dispatches a pointerdown first, so the menu stays
  // closed and every query against its contents silently finds nothing.
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(trigger);
}

describe("ProjectPreviewPanel - archived edit guard", () => {
  it("offers a usable Edit action for a non-archived project", () => {
    const { onEdit } = renderPanel({ project: { status: "ACTIVE" } });

    openActionsMenu();

    const editItem = screen.getByRole("menuitem", { name: "Edit" });
    fireEvent.click(editItem);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("does not offer Edit for an archived project", () => {
    renderPanel({ project: { status: "ARCHIVED" } });

    openActionsMenu();

    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("keeps Restore available for an archived project", () => {
    const { onRestore } = renderPanel({ project: { status: "ARCHIVED" } });

    openActionsMenu();

    const restoreItem = screen.getByRole("menuitem", { name: "Restore" });
    fireEvent.click(restoreItem);

    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("does not offer Archive for an archived project (Restore replaces it, same as before this change)", () => {
    renderPanel({ project: { status: "ARCHIVED" } });

    openActionsMenu();

    expect(screen.queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("leaves unrelated preview content and the Open project action intact when archived", () => {
    const { onOpenProject } = renderPanel({
      project: { status: "ARCHIVED", name: "Legacy Migration" },
    });

    expect(screen.getByText("Legacy Migration")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open project" }));
    expect(onOpenProject).toHaveBeenCalledWith("website-redesign");
  });
});

describe("ProjectPreviewPanel - archived ownership-transfer guard", () => {
  const eligiblePreviewData: ProjectPreviewData = {
    ownerId: "user-owner",
    ownerName: "Ada Lovelace",
    startDate: null,
    targetDate: null,
  };

  it("offers Transfer ownership for a non-archived project when the actor is eligible", () => {
    mockUseWorkspaceMembers.mockReturnValue({
      data: [{ userId: "user-admin", name: "Grace Hopper", role: "ADMIN" }],
      isLoading: false,
    });

    renderPanel({
      project: { status: "ACTIVE" },
      previewData: eligiblePreviewData,
      actorRole: "OWNER",
    });

    openActionsMenu();

    expect(screen.getByRole("menuitem", { name: "Transfer ownership" })).toBeInTheDocument();
  });

  it("does not offer Transfer ownership for an archived project, even when the actor is eligible", () => {
    mockUseWorkspaceMembers.mockReturnValue({
      data: [{ userId: "user-admin", name: "Grace Hopper", role: "ADMIN" }],
      isLoading: false,
    });

    renderPanel({
      project: { status: "ARCHIVED" },
      previewData: eligiblePreviewData,
      actorRole: "OWNER",
    });

    openActionsMenu();

    expect(
      screen.queryByRole("menuitem", { name: "Transfer ownership" }),
    ).not.toBeInTheDocument();
    // Restore must still be there - proves the menu genuinely opened and
    // this isn't a vacuous pass from a closed dropdown.
    expect(screen.getByRole("menuitem", { name: "Restore" })).toBeInTheDocument();
  });
});
