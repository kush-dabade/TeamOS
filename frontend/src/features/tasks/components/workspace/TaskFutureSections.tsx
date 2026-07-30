import { Card, CardContent, CardHeader } from "@/components/ui";
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
        <Card size="sm">
          <CardHeader>
            <h3 className="text-sm font-medium">Attachments</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Task attachments will appear here.</p>
          </CardContent>
        </Card>
        <TaskActivity workspaceId={workspaceId} taskId={taskId} />
      </div>
    </section>
  );
}
