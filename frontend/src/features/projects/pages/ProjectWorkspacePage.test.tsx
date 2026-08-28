import { MemoryRouter, Route, Routes } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectDetail, ProjectListItem } from "../types";

import { ProjectWorkspacePage } from "./ProjectWorkspacePage";

// This test exercises only the slug-resolution branching in
// ProjectWorkspacePage (normal list -> archived fallback -> not found). The
// page's own child components (header/nav/content/edit panel) each pull in
// their own feature trees, so they're stubbed out here - the same
// "test behavior, not implementation" boundary the rest of this repo's
// hook/component tests already draw.
vi.mock("../components/workspace", () => ({
  ProjectHeader: ({ project }: { project: ProjectListItem }) => (
    <div data-testid="project-header">{project.project.name}</div>
  ),
  ProjectNavigation: () => null,
  WorkspaceContent: () => null,
}));

vi.mock("../components/form", () => ({
  ProjectFormPanel: () => null,
}));

const mockUseActiveWorkspace = vi.fn();
vi.mock("@/features/workspaces", () => ({
  useActiveWorkspace: () => mockUseActiveWorkspace(),
}));

const mockUseProjects = vi.fn();
vi.mock("../hooks/use-projects", () => ({
  useProjects: (...args: unknown[]) => mockUseProjects(...args),
}));

const mockUseProjectWithTaskCounts = vi.fn();
vi.mock("../hooks/use-project-with-task-counts", () => ({
  useProjectWithTaskCounts: (...args: unknown[]) => mockUseProjectWithTaskCounts(...args),
}));

vi.mock("../hooks/use-update-project", () => ({
  useUpdateProject: () => ({ mutateAsync: vi.fn() }),
}));

const WORKSPACE_ID = "workspace-1";

function buildListItem(overrides: Partial<ProjectListItem["project"]> = {}): ProjectListItem {
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
    completedTaskCount: 0,
    totalTaskCount: 0,
    progressPercentage: 0,
  };
}

function buildQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isPending: false,
    isSuccess: true,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function buildDetail(listItem: ProjectListItem): ProjectDetail {
  return {
    project: listItem,
    previewData: {
      ownerId: "user-1",
      ownerName: "Ada Lovelace",
      startDate: null,
      targetDate: null,
    },
  };
}

function renderPage(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/projects/${slug}`]}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  mockUseActiveWorkspace.mockReset();
  mockUseProjects.mockReset();
  mockUseProjectWithTaskCounts.mockReset();
  mockUseActiveWorkspace.mockReturnValue({ workspaceId: WORKSPACE_ID });
});

describe("ProjectWorkspacePage - slug resolution", () => {
  it("resolves a normal project through the primary list, without enabling the archived fallback", () => {
    const normalProject = buildListItem();

    mockUseProjects.mockImplementation((workspaceId: string | undefined, status?: string) => {
      if (status === "ARCHIVED") {
        // The fallback must stay disabled: the primary list already
        // resolved the slug, so it's never asked for the real workspaceId.
        expect(workspaceId).toBeUndefined();
        return buildQueryResult({ data: undefined });
      }

      return buildQueryResult({ data: [normalProject] });
    });

    mockUseProjectWithTaskCounts.mockImplementation((projectId: string | undefined) => {
      if (projectId === "project-1") {
        return buildQueryResult({ data: buildDetail(normalProject) });
      }
      return buildQueryResult({ data: undefined });
    });

    renderPage("website-redesign");

    expect(screen.getByTestId("project-header")).toHaveTextContent("Website Redesign");
    expect(screen.queryByText("Project not found")).not.toBeInTheDocument();

    const archivedCalls = mockUseProjects.mock.calls.filter(([, status]) => status === "ARCHIVED");
    expect(archivedCalls.length).toBeGreaterThan(0);
    expect(archivedCalls.every(([calledWorkspaceId]) => calledWorkspaceId === undefined)).toBe(
      true,
    );
  });

  it("resolves an archived project through the archived fallback query", () => {
    const archivedProject = buildListItem({
      id: "project-2",
      slug: "legacy-migration",
      name: "Legacy Migration",
      status: "ARCHIVED",
    });

    mockUseProjects.mockImplementation((_workspaceId: string | undefined, status?: string) => {
      if (status === "ARCHIVED") {
        return buildQueryResult({ data: [archivedProject] });
      }

      // Primary (default) list excludes archived projects.
      return buildQueryResult({ data: [] });
    });

    mockUseProjectWithTaskCounts.mockImplementation((projectId: string | undefined) => {
      if (projectId === "project-2") {
        return buildQueryResult({ data: buildDetail(archivedProject) });
      }
      return buildQueryResult({ data: undefined });
    });

    renderPage("legacy-migration");

    expect(screen.getByTestId("project-header")).toHaveTextContent("Legacy Migration");
    expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
  });

  it("shows Project not found when the slug matches neither list", () => {
    mockUseProjects.mockImplementation((_workspaceId: string | undefined, status?: string) => {
      if (status === "ARCHIVED") {
        return buildQueryResult({ data: [] });
      }
      return buildQueryResult({ data: [] });
    });

    mockUseProjectWithTaskCounts.mockReturnValue(buildQueryResult({ data: undefined }));

    renderPage("does-not-exist");

    expect(screen.getByText("Project not found")).toBeInTheDocument();
  });
});
