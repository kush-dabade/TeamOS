import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectListItem } from "../../types";

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
});

// actorRole is left undefined in every test below, which keeps
// canTransferOwnership false regardless of the members list - so the members
// query result is irrelevant here and a static empty list is enough.
vi.mock("@/features/workspaces", () => ({
  useWorkspaceMembers: () => ({ data: [], isLoading: false }),
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

function renderPanel(overrides: Partial<ProjectListItem["project"]> = {}) {
  const onEdit = vi.fn();
  const onArchive = vi.fn();
  const onRestore = vi.fn();
  const onOpenProject = vi.fn();

  render(
    <ProjectPreviewPanel
      project={buildProject(overrides)}
      previewData={null}
      isPreviewLoading={false}
      isArchiving={false}
      isRestoring={false}
      workspaceId="workspace-1"
      actorRole={undefined}
      open={true}
      onClose={vi.fn()}
      onCloseAutoFocus={vi.fn()}
      onOpenProject={onOpenProject}
      onEdit={onEdit}
      onArchive={onArchive}
      onRestore={onRestore}
    />,
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
    const { onEdit } = renderPanel({ status: "ACTIVE" });

    openActionsMenu();

    const editItem = screen.getByRole("menuitem", { name: "Edit" });
    fireEvent.click(editItem);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("does not offer Edit for an archived project", () => {
    renderPanel({ status: "ARCHIVED" });

    openActionsMenu();

    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("keeps Restore available for an archived project", () => {
    const { onRestore } = renderPanel({ status: "ARCHIVED" });

    openActionsMenu();

    const restoreItem = screen.getByRole("menuitem", { name: "Restore" });
    fireEvent.click(restoreItem);

    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("does not offer Archive for an archived project (Restore replaces it, same as before this change)", () => {
    renderPanel({ status: "ARCHIVED" });

    openActionsMenu();

    expect(screen.queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("leaves unrelated preview content and the Open project action intact when archived", () => {
    const { onOpenProject } = renderPanel({ status: "ARCHIVED", name: "Legacy Migration" });

    expect(screen.getByText("Legacy Migration")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open project" }));
    expect(onOpenProject).toHaveBeenCalledWith("website-redesign");
  });
});
