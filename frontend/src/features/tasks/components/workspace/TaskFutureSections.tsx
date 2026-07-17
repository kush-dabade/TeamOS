import { Card, CardContent, CardHeader } from "@/components/ui";

const futureSections = [
  { title: "Comments", description: "Task comments will appear here." },
  { title: "Attachments", description: "Task attachments will appear here." },
  { title: "Activity", description: "Task activity will appear here." },
];

export function TaskFutureSections() {
  return (
    <section aria-labelledby="task-collaboration-heading">
      <h2 id="task-collaboration-heading" className="text-xl font-semibold tracking-tight">
        Collaboration
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {futureSections.map((section) => (
          <Card key={section.title} size="sm">
            <CardHeader>
              <h3 className="text-sm font-medium">{section.title}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
