import { useRef } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui";

import type { Project } from "../../types";
import type { ProjectFormData } from "../../validation/project";

import { ProjectForm } from "./ProjectForm";

interface ProjectFormPanelProps {
  mode: "create" | "edit" | null;
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: () => void;
  onSubmit: (data: ProjectFormData) => void | Promise<void>;
}

export function ProjectFormPanel({
  mode,
  project,
  open,
  onClose,
  onCloseAutoFocus,
  onSubmit,
}: ProjectFormPanelProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  if (!mode) {
    return null;
  }

  const defaultValues: ProjectFormData =
    mode === "edit" && project
      ? {
          name: project.name,
          description: project.description ?? "",
          status: project.status,
        }
      : {
          name: "",
          description: "",
          status: "PLANNED",
        };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-[440px] gap-0 p-0 sm:max-w-[440px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          nameInputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <SheetHeader className="border-b p-4 pr-12">
          <SheetTitle>{mode === "create" ? "New project" : "Edit project"}</SheetTitle>
        </SheetHeader>

        <ProjectForm
          key={`${mode}-${project?.id ?? "new"}-${open ? "open" : "closed"}`}
          mode={mode}
          defaultValues={defaultValues}
          nameInputRef={nameInputRef}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </SheetContent>
    </Sheet>
  );
}
