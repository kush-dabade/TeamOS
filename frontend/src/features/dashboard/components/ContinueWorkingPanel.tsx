import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui";

import { DashboardPanel } from "./layout";
import { ContinueWorkingRow, ContinueWorkingSkeleton } from "./continue-working";

import { useContinueWorking } from "../hooks/use-continue-working";
import type { ContinueWorkingItem } from "../types";

const MAX_VISIBLE_ITEMS = 5;

export function ContinueWorkingPanel() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useContinueWorking();

  const visibleItems = data.slice(0, MAX_VISIBLE_ITEMS);

  const handleSelect = (item: ContinueWorkingItem) => {
    navigate(`/projects/${item.slug}`);
  };

  let content: ReactNode;

  if (isError) {
    content = (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load recent work</p>
        <p className="text-muted-foreground text-sm">
          Something went wrong while loading this section.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={refetch}>
          Try again
        </Button>
      </div>
    );
  } else if (isLoading) {
    content = <ContinueWorkingSkeleton />;
  } else if (visibleItems.length === 0) {
    content = (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">No recent work</p>
        <p className="text-muted-foreground text-sm">Projects you work on will appear here.</p>
        <Button type="button" size="sm" className="mt-2" onClick={() => navigate("/projects")}>
          Browse projects
        </Button>
      </div>
    );
  } else {
    content = (
      <div className="divide-border divide-y">
        {visibleItems.map((item) => (
          <ContinueWorkingRow key={item.id} item={item} onSelect={handleSelect} />
        ))}
      </div>
    );
  }

  return (
    <DashboardPanel
      title="Continue Working"
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs font-medium"
          onClick={() => navigate("/projects")}
        >
          View all
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      }
    >
      {content}
    </DashboardPanel>
  );
}
