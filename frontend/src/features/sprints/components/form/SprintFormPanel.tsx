import { useRef } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui";

import type { Sprint } from "../../types";
import type { SprintFormData } from "../../validation/sprint";

import { SprintForm } from "./SprintForm";

interface SprintFormPanelProps {
  mode: "create" | "edit" | null;
  sprint: Sprint | null;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: () => void;
  onSubmit: (data: SprintFormData) => void | Promise<void>;
}

export function SprintFormPanel({
  mode,
  sprint,
  open,
  onClose,
  onCloseAutoFocus,
  onSubmit,
}: SprintFormPanelProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  if (!mode) {
    return null;
  }

  const defaultValues: SprintFormData =
    mode === "edit" && sprint
      ? {
          name: sprint.name,
          goal: sprint.goal ?? "",
          startDate: sprint.startDate?.slice(0, 10) ?? "",
          endDate: sprint.endDate?.slice(0, 10) ?? "",
        }
      : {
          name: "",
          goal: "",
          startDate: "",
          endDate: "",
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
          <SheetTitle>{mode === "create" ? "New sprint" : "Edit sprint"}</SheetTitle>
        </SheetHeader>

        <SprintForm
          key={`${mode}-${sprint?.id ?? "new"}-${open ? "open" : "closed"}`}
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
