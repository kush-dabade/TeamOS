import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectListItem, ProjectPreviewData } from "../../types";

import { ProjectHeader } from "./ProjectHeader";

// This repo's vitest config runs with `globals: false`, so Testing Library's
// automatic afterEach(cleanup) never registers - clean up explicitly before
// every render instead (see TaskForm.test.tsx for the same note).
beforeEach(() => {
  cleanup();
});

function buildProject(overrides: Partial<ProjectListItem["project"]> = {}): ProjectListItem {
  return {
    project: {
      id: "project-1",
      slug: "website-redesign",
      name: "Website Redesign",
      description: "Refresh the marketing site.",
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

const previewData: ProjectPreviewData = {
  ownerId: "user-1",
  ownerName: "Ada Lovelace",
  startDate: null,
  targetDate: null,
};

function renderHeader(overrides: Partial<ProjectListItem["project"]> = {}) {
  const onEdit = vi.fn();
  render(
    <ProjectHeader project={buildProject(overrides)} previewData={previewData} onEdit={onEdit} />,
  );
  return { onEdit };
}

describe("ProjectHeader - archived edit guard", () => {
  it("offers Edit project for a non-archived project", () => {
    renderHeader({ status: "ACTIVE" });

    expect(screen.getByRole("button", { name: "Edit project" })).toBeInTheDocument();
  });

  it("does not offer Edit project for an archived project", () => {
    renderHeader({ status: "ARCHIVED" });

    expect(screen.queryByRole("button", { name: "Edit project" })).not.toBeInTheDocument();
  });

  it("still shows the project's title, status, and task summary when archived", () => {
    renderHeader({ status: "ARCHIVED", name: "Legacy Migration" });

    expect(screen.getByRole("heading", { name: "Legacy Migration" })).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("3 / 10 Tasks")).toBeInTheDocument();
  });
});
