import { apiClient, type ApiSuccess } from "@/lib/api";

import type { Comment } from "../types";

interface BackendComment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
}

export interface CreateCommentInput {
  content: string;
}

export interface UpdateCommentInput {
  content: string;
}

export interface CommentPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// The comment list endpoint's envelope nests results under `data.comments`
// with a sibling `pagination` block, matching the Tasks/Activity list
// endpoints' own local response shape - not a shared generic type, since
// none of those endpoints use one either.
interface CommentListResponse {
  success: true;
  data: {
    comments: BackendComment[];
  };
  pagination: CommentPagination;
}

export interface ListTaskCommentsParams {
  page?: number;
  limit?: number;
}

export interface ListTaskCommentsResult {
  comments: Comment[];
  pagination: CommentPagination;
}

function toComment(comment: BackendComment): Comment {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.author,
  };
}

export async function fetchTaskComments(
  taskId: string,
  params: ListTaskCommentsParams = {},
): Promise<ListTaskCommentsResult> {
  const response = await apiClient.get<CommentListResponse>(`/tasks/${taskId}/comments`, {
    params,
  });

  return {
    comments: response.data.data.comments.map(toComment),
    pagination: response.data.pagination,
  };
}

export async function createComment(
  taskId: string,
  input: CreateCommentInput,
): Promise<Comment> {
  const response = await apiClient.post<ApiSuccess<{ comment: BackendComment }>>(
    `/tasks/${taskId}/comments`,
    input,
  );

  return toComment(response.data.data.comment);
}

export async function updateComment(
  commentId: string,
  input: UpdateCommentInput,
): Promise<Comment> {
  const response = await apiClient.patch<ApiSuccess<{ comment: BackendComment }>>(
    `/comments/${commentId}`,
    input,
  );

  return toComment(response.data.data.comment);
}

// The backend responds 204 No Content on delete (no envelope body to parse).
export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/comments/${commentId}`);
}
