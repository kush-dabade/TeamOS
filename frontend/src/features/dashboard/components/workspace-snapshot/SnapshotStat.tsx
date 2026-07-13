import type { ReactNode } from "react";

interface SnapshotStatProps {
  label: string;
  value: ReactNode;
}

export function SnapshotStat({ label, value }: SnapshotStatProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-muted-foreground text-sm">{label}</span>

      <span className="text-base font-semibold tracking-tight">{value}</span>
    </div>
  );
}
