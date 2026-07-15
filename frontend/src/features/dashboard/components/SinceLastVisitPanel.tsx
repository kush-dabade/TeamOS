import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui";

import { DashboardPanel } from "./layout";
import { TimelineEvent } from "./since-last-visit";

import { mockEvents } from "../data/dashboard.mock";

export function SinceLastVisitPanel() {
  return (
    <DashboardPanel
      title="Since Your Last Visit"
      action={
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium">
          View all
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      }
    >
      <div className="divide-border -mx-2 divide-y">
        {mockEvents.map((event) => (
          <TimelineEvent key={event.id} event={event} />
        ))}
      </div>
    </DashboardPanel>
  );
}
