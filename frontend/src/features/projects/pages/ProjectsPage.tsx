import { useState } from "react";

import { PageLayout } from "@/components/layout";

import { ProjectsToolbar } from "../components/toolbar";
import type { ProjectSortOption, ProjectStatusFilter } from "../types";

export function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("ALL");
  const [sortOption, setSortOption] = useState<ProjectSortOption>("RECENTLY_UPDATED");

  return (
    <PageLayout>
      <div className="mt-3">
        <ProjectsToolbar
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          sortOption={sortOption}
          onSearchQueryChange={setSearchQuery}
          onStatusFilterChange={setStatusFilter}
          onSortOptionChange={setSortOption}
        />
      </div>
    </PageLayout>
  );
}
