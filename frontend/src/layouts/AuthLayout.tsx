import type { PropsWithChildren } from "react";

interface AuthLayoutProps extends PropsWithChildren {
  title: string;
  description: string;
}

export default function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-muted lg:flex">
        <div className="flex h-full w-full flex-col justify-between p-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">TeamOS</h2>
          </div>

          <div className="max-w-sm space-y-4">
            <h3 className="text-4xl font-semibold tracking-tight">
              Plan.
              <br />
              Track.
              <br />
              Deliver.
            </h3>

            <p className="text-muted-foreground">
              Modern project management built for focused teams.
            </p>
          </div>

          <div className="rounded-xl border border-dashed p-6">
            <p className="font-medium">Dashboard preview</p>

            <p className="mt-2 text-sm text-muted-foreground">Coming soon.</p>
          </div>
        </div>
      </section>

      <section className="flex p-6 md:p-10">
        <div className="mx-auto flex w-full max-w-md flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>

            <p className="mt-2 text-muted-foreground">{description}</p>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
