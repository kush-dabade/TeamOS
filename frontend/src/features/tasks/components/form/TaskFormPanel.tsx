import { useRef } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui";

import type { TaskAssignee, TaskListItem, TaskProject } from "../../types";
import type { TaskFormData } from "../../validation/task";

import { TaskForm } from "./TaskForm";

interface TaskFormPanelProps {
  mode: "create" | "edit" | null;
  taskItem: TaskListItem | null;
  projects: TaskProject[];
  assignees: TaskAssignee[];
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: () => void;
  onSubmit: (data: TaskFormData) => void | Promise<void>;
}

export function TaskFormPanel({
  mode,
  taskItem,
  projects,
  assignees,
  open,
  onClose,
  onCloseAutoFocus,
  onSubmit,
}: TaskFormPanelProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);

  if (!mode) {
    return null;
  }

  const defaultValues: TaskFormData =
    mode === "edit" && taskItem
      ? {
          title: taskItem.task.title,
          projectId: taskItem.task.projectId,
          description: taskItem.task.description ?? "",
          priority: taskItem.task.priority,
          status: taskItem.task.status,
          assigneeId: taskItem.task.assigneeId ?? "",
          dueDate: taskItem.task.dueDate?.slice(0, 10) ?? "",
        }
      : {
          title: "",
          projectId: "",
          description: "",
          priority: "MEDIUM",
          // Not shown or sent in create mode (TaskForm hides the control,
          // and TasksPage/ProjectTasks build the createTask payload manually
          // without status) - only present to satisfy the shared schema.
          status: "TODO",
          assigneeId: "",
          dueDate: "",
        };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-[440px] gap-0 p-0 sm:max-w-[440px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleInputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <SheetHeader className="border-b p-4 pr-12">
          <SheetTitle>{mode === "create" ? "New task" : "Edit task"}</SheetTitle>
        </SheetHeader>

        <TaskForm
          key={`${mode}-${taskItem?.task.id ?? "new"}-${open ? "open" : "closed"}`}
          mode={mode}
          defaultValues={defaultValues}
          projects={projects}
          assignees={assignees}
          titleInputRef={titleInputRef}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </SheetContent>
    </Sheet>
  );
}
