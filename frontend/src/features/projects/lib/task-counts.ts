import type { Task } from "@/features/tasks";

export interface TaskCounts {
  totalTaskCount: number;
  completedTaskCount: number;
  progressPercentage: number;
}

export function countTasks(tasks: Task[]): TaskCounts {
  const totalTaskCount = tasks.length;
  const completedTaskCount = tasks.filter((task) => task.status === "DONE").length;

  return {
    totalTaskCount,
    completedTaskCount,
    progressPercentage:
      totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100),
  };
}
