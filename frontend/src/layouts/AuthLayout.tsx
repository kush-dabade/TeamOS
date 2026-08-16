import { Layers3 } from "lucide-react";
import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

interface AuthLayoutProps extends PropsWithChildren {
  title: string;
  description: string;
}

export default function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link to="/" className="inline-flex w-fit items-center gap-2">
          <Layers3 className="size-6 text-foreground" />
          <span className="text-lg font-semibold tracking-tight">TeamOS</span>
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>

              <p className="mt-2 text-muted-foreground">{description}</p>
            </div>

            {children}
          </div>
        </div>
      </div>

      <div className="hidden p-4 lg:flex lg:items-stretch lg:p-6">
        <div className="flex w-full flex-col justify-center rounded-3xl border border-border bg-muted p-10 xl:p-14">
          <h2 className="font-heading text-4xl leading-[0.95] tracking-tight xl:text-5xl 2xl:text-6xl">
            <span className="block font-light text-muted-foreground">Work moves better</span>
            <span className="block font-light text-muted-foreground">when everything</span>
            <span className="block font-semibold text-foreground">is connected.</span>
          </h2>

          <div aria-hidden="true" className="my-8 h-px w-10 bg-border" />

          <p className="max-w-xs text-base text-muted-foreground">
            TeamOS brings planning, execution, and collaboration into one workspace.
          </p>
        </div>
      </div>
    </main>
  );
}
