import { apiClient } from "@/lib/api";

import type { ActivityEntityType, ActivityType, RecentActivityItem } from "../types";

interface BackendActivity {
  id: string;
  type: ActivityType;
  entityType: ActivityEntityType;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    image: string | null;
  };
}

// The activity list endpoint's envelope nests results under `data.activities`
// and carries a sibling `pagination` block, unlike the flat `ApiSuccess<T>`
// envelope other features use - so it gets its own response shape here rather
// than being forced into the shared one.
interface ActivityListResponse {
  success: true;
  data: {
    activities: BackendActivity[];
  };
}

function toRecentActivityItem(activity: BackendActivity): RecentActivityItem {
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

export async function fetchRecentActivity(
  workspaceId: string,
  limit: number,
): Promise<RecentActivityItem[]> {
  const response = await apiClient.get<ActivityListResponse>(
    `/workspaces/${workspaceId}/activity`,
    { params: { page: 1, limit } },
  );

  return response.data.data.activities.map(toRecentActivityItem);
}
