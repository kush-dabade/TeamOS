import { useState } from "react";
import { useParams } from "react-router-dom";

import { PageLayout } from "@/components/layout";

import { mockProjectPreviewData, mockProjects } from "../data/projects.mock";
import { ProjectFormPanel } from "../components/form";
import { ProjectHeader, ProjectNavigation, WorkspaceContent } from "../components/workspace";
import type { ProjectListItem, ProjectWorkspaceTab } from "../types";
import type { ProjectFormData } from "../validation/project";

export function ProjectWorkspacePage() {
  const { slug } = useParams();
  const resolvedProject = mockProjects.find((item) => item.project.slug === slug) ?? null;
  const [editedProject, setEditedProject] = useState<ProjectListItem | null>(null);
  const [tabSelection, setTabSelection] = useState<{
    projectSlug: string | undefined;
    tab: ProjectWorkspaceTab;
  }>({ projectSlug: slug, tab: "tasks" });
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [formPanelTrigger, setFormPanelTrigger] = useState<HTMLButtonElement | null>(null);

  const project = editedProject?.project.slug === slug ? editedProject : resolvedProject;
  const activeTab = tabSelection.projectSlug === slug ? tabSelection.tab : "tasks";

  if (!project) {
    return (
      <PageLayout>
        <p className="mt-3 text-sm text-muted-foreground">Project not found.</p>
      </PageLayout>
    );
  }

  const previewData = mockProjectPreviewData[project.project.id] ?? null;

  const handleEdit = (trigger: HTMLButtonElement) => {
    setFormPanelTrigger(trigger);
    setIsFormPanelOpen(true);
  };

  const handleCloseAutoFocus = () => {
    formPanelTrigger?.focus();
    setFormPanelTrigger(null);
  };

  const handleProjectSubmit = (data: ProjectFormData) => {
    setEditedProject({
      ...project,
      project: {
        ...project.project,
        name: data.name,
        description: data.description || null,
        status: data.status,
        updatedAt: new Date().toISOString(),
      },
    });
    setIsFormPanelOpen(false);
  };

  return (
    <PageLayout>
      <ProjectHeader project={project} previewData={previewData} onEdit={handleEdit} />
      <ProjectNavigation
        activeTab={activeTab}
        onTabChange={(tab) => setTabSelection({ projectSlug: slug, tab })}
      />
      <WorkspaceContent project={project} activeTab={activeTab} />

      <ProjectFormPanel
        mode="edit"
        project={project.project}
        open={isFormPanelOpen}
        onClose={() => setIsFormPanelOpen(false)}
        onCloseAutoFocus={handleCloseAutoFocus}
        onSubmit={handleProjectSubmit}
      />
    </PageLayout>
  );
}
