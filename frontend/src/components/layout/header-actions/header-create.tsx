import { useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, Building2, ListTodo, PlusIcon, Rocket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth";
import {
  ProjectFormPanel,
  useCreateProject,
  useProjects,
  type ProjectFormData,
} from "@/features/projects";
import {
  TaskFormPanel,
  useCreateTask,
  type TaskAssignee,
  type TaskFormData,
  type TaskProject,
} from "@/features/tasks";
import { CreateWorkspaceForm, useActiveWorkspace, useWorkspaceMembers } from "@/features/workspaces";

import { CreateSprintFlow } from "./create-sprint-flow";

type CreatePanel = "project" | "task" | "sprint" | "workspace" | null;

export function HeaderCreate() {
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();

  const [activePanel, setActivePanel] = useState<CreatePanel>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const projectsQuery = useProjects(workspace?.id);
  const membersQuery = useWorkspaceMembers(workspace?.id);

  const projects: TaskProject[] = useMemo(
    () =>
      (projectsQuery.data ?? []).map(({ project }) => ({
        id: project.id,
        slug: project.slug,
        name: project.name,
      })),
    [projectsQuery.data],
  );
  const assignees: TaskAssignee[] = useMemo(
    () => (membersQuery.data ?? []).map((member) => ({ id: member.userId, name: member.name })),
    [membersQuery.data],
  );

  const createProject = useCreateProject(workspace?.id ?? "");
  const createTask = useCreateTask();

  const closePanel = () => setActivePanel(null);

  const handleCloseAutoFocus = () => {
    triggerRef.current?.focus();
    closePanel();
  };

  const handleCreateProject = async (data: ProjectFormData) => {
    if (!workspace || !user) {
      return;
    }

    await createProject.mutateAsync({
      ownerId: user.id,
      name: data.name,
      description: data.description || undefined,
    });
    closePanel();
  };

  const handleCreateTask = async (data: TaskFormData) => {
    if (!data.projectId) {
      return;
    }

    await createTask.mutateAsync({
      projectId: data.projectId,
      input: {
        title: data.title,
        description: data.description || undefined,
        priority: data.priority,
        assigneeId: data.assigneeId || undefined,
        dueDate: data.dueDate || undefined,
      },
    });
    toast.success("Task created");
    closePanel();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            size="icon-lg"
            variant="secondary"
            aria-label="Create"
          >
            <PlusIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setActivePanel("project")}>
            <BriefcaseBusiness className="size-4" />
            Project
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setActivePanel("task")}>
            <ListTodo className="size-4" />
            Task
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setActivePanel("sprint")}>
            <Rocket className="size-4" />
            Sprint
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setActivePanel("workspace")}>
            <Building2 className="size-4" />
            Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectFormPanel
        mode={activePanel === "project" ? "create" : null}
        project={null}
        open={activePanel === "project"}
        onClose={closePanel}
        onCloseAutoFocus={handleCloseAutoFocus}
        onSubmit={handleCreateProject}
      />

      <TaskFormPanel
        mode={activePanel === "task" ? "create" : null}
        taskItem={null}
        projects={projects}
        assignees={assignees}
        open={activePanel === "task"}
        onClose={closePanel}
        onCloseAutoFocus={handleCloseAutoFocus}
        onSubmit={handleCreateTask}
      />

      <CreateSprintFlow
        open={activePanel === "sprint"}
        onOpenChange={(open) => !open && closePanel()}
        onCloseAutoFocus={handleCloseAutoFocus}
        projects={projects}
        isProjectsLoading={projectsQuery.isLoading}
        isProjectsError={projectsQuery.isError}
        onRetryProjects={() => projectsQuery.refetch()}
      />

      <Dialog open={activePanel === "workspace"} onOpenChange={(open) => !open && closePanel()}>
        <DialogContent className="gap-6 p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              Create a separate workspace to organize a different team&apos;s projects and tasks.
            </DialogDescription>
          </DialogHeader>

          <CreateWorkspaceForm onSuccess={closePanel} />
        </DialogContent>
      </Dialog>
    </>
  );
}
