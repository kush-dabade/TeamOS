import { SprintsView } from "@/features/sprints";

interface ProjectSprintsProps {
  projectId: string;
}

export function ProjectSprints({ projectId }: ProjectSprintsProps) {
  return <SprintsView projectId={projectId} />;
}
