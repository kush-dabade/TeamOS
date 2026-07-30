import { Card, CardContent, CardHeader } from "@/components/ui";

import { TaskActivity } from "../TaskActivity";

const placeholderSections = [
  { title: "Comments", description: "Task comments will appear here." },
  { title: "Attachments", description: "Task attachments will appear here." },
];

interface TaskFutureSectionsProps {
  workspaceId: string;
  taskId: string;
}

export function TaskFutureSections({ workspaceId, taskId }: TaskFutureSectionsProps) {
  return (
    <section aria-labelledby="task-collaboration-heading">
      <h2 id="task-collaboration-heading" className="text-sm font-medium">Collaboration</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {placeholderSections.map((section) => (
          <Card key={section.title} size="sm">
            <CardHeader>
              <h3 className="text-sm font-medium">{section.title}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </CardContent>
          </Card>
        ))}
        <TaskActivity workspaceId={workspaceId} taskId={taskId} />
      </div>
    </section>
  );
}
