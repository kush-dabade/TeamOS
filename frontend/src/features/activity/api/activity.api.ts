import { apiClient } from "@/lib/api";

import type { Activity, ActivityEntityType } from "../types";

interface BackendActivity {
  id: string;
  type: Activity["type"];
  entityType: Activity["entityType"];
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    image: string | null;
  };
}

interface ActivityPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// The activity list endpoint's envelope nests results under `data.activities`
// with a sibling `pagination` block, unlike the flat `ApiSuccess<T>` envelope
// other features use - so it gets its own response shape here rather than
// being forced into the shared one.
interface ActivityListResponse {
  success: true;
  data: {
    activities: BackendActivity[];
  };
  pagination: ActivityPagination;
}

export interface ListActivitiesParams {
  page?: number;
  limit?: number;
  entityType?: ActivityEntityType;
  entityId?: string;
}

export interface ListActivitiesResult {
  activities: Activity[];
  pagination: ActivityPagination;
}

function toActivity(activity: BackendActivity): Activity {
  return {
    id: activity.id,
    type: activity.type,
    entityType: activity.entityType,
    entityId: activity.entityId,
    metadata: activity.metadata,
    actor: activity.actor,
    createdAt: activity.createdAt,
  };
}

export async function fetchWorkspaceActivities(
  workspaceId: string,
  params: ListActivitiesParams = {},
): Promise<ListActivitiesResult> {
  const response = await apiClient.get<ActivityListResponse>(
    `/workspaces/${workspaceId}/activity`,
    { params },
  );

  return {
    activities: response.data.data.activities.map(toActivity),
    pagination: response.data.pagination,
  };
}
