import { Layers3 } from "lucide-react";

import { CreateWorkspaceForm } from "../components/create-workspace-form";

export function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 className="size-6 text-foreground" />
            <span className="text-lg font-bold tracking-tight">TeamOS</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Welcome to TeamOS</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Create a workspace to start organizing your team&apos;s projects and tasks.
          </p>
        </div>

        <CreateWorkspaceForm />
      </div>
    </main>
  );
}
