import { LayoutDashboard } from "lucide-react";

/**
 * Foundation only — the frame this section will hold real TeamOS UI in
 * (Commit 2). Deliberately not a fabricated screenshot/mockup.
 */
export function ProductPreviewSection() {
  return (
    <section aria-label="Product preview" className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex aspect-video max-w-5xl items-center justify-center rounded-3xl border border-border bg-muted">
        <LayoutDashboard className="size-10 text-muted-foreground/40" aria-hidden="true" />
      </div>
    </section>
  );
}
