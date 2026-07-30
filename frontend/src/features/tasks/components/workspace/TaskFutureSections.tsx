import { AttachmentsPanel } from "@/features/attachments";
import { CommentsPanel } from "@/features/comments";

import { TaskActivity } from "../TaskActivity";

interface TaskFutureSectionsProps {
  workspaceId: string;
  taskId: string;
}

export function TaskFutureSections({ workspaceId, taskId }: TaskFutureSectionsProps) {
  return (
    <section aria-labelledby="task-collaboration-heading">
      <h2 id="task-collaboration-heading" className="text-sm font-medium">Collaboration</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <CommentsPanel taskId={taskId} />
        <AttachmentsPanel taskId={taskId} />
        <TaskActivity workspaceId={workspaceId} taskId={taskId} />
      </div>
    </section>
  );
}
