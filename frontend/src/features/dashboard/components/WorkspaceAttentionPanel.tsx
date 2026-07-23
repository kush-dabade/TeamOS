import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui";
import { EmptyState } from "@/components/ux";

import { DashboardPanel } from "./layout";
import { WorkspaceAttentionRow, WorkspaceAttentionSkeleton } from "./workspace-attention";

import { useWorkspaceAttention } from "../hooks/use-workspace-attention";
import type { WorkspaceAttentionItem } from "../types";

const MAX_VISIBLE_ITEMS = 5;

export function WorkspaceAttentionPanel() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useWorkspaceAttention();

  const visibleItems = data.slice(0, MAX_VISIBLE_ITEMS);

  const handleSelect = (item: WorkspaceAttentionItem) => {
    if (item.entityType === "TASK") {
      navigate(`/tasks/${item.entityId}`);
    }
  };

  let content: ReactNode;

  if (isError) {
    content = (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load attention items</p>
        <p className="text-muted-foreground text-sm">
          Something went wrong while loading this section.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={refetch}>
          Try again
        </Button>
      </div>
    );
  } else if (isLoading) {
    content = <WorkspaceAttentionSkeleton />;
  } else if (visibleItems.length === 0) {
    content = (
      <div className="flex min-h-40 items-center justify-center">
        <EmptyState
          icon={CircleCheck}
          title="Everything looks good"
          description="No items need your attention right now."
        />
      </div>
    );
  } else {
    content = (
      <div className="divide-border divide-y">
        {visibleItems.map((item) => (
          <WorkspaceAttentionRow key={item.id} item={item} onSelect={handleSelect} />
        ))}
      </div>
    );
  }

  return <DashboardPanel title="Workspace attention">{content}</DashboardPanel>;
}
