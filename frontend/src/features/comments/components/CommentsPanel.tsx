import { useState } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui";
import { useAuth } from "@/features/auth";

import { CommentForm } from "./CommentForm";
import { CommentList } from "./CommentList";
import { useComments } from "../hooks/use-comments";
import { useCreateComment } from "../hooks/use-create-comment";
import { useDeleteComment } from "../hooks/use-delete-comment";
import { useUpdateComment } from "../hooks/use-update-comment";

interface CommentsPanelProps {
  taskId: string;
}

// The only stateful comments component. Owns the list query, all three
// mutations, and which comment (if any) is currently being edited.
// CommentList/CommentItem/CommentForm are presentational - none of them
// call a hook from ../hooks or ../api directly.
export function CommentsPanel({ taskId }: CommentsPanelProps) {
  const { user } = useAuth();
  const commentsQuery = useComments(taskId);
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

  const handleCreate = async (content: string) => {
    await createComment.mutateAsync({ taskId, input: { content } });
  };

  const handleEditSubmit = async (commentId: string, content: string) => {
    await updateComment.mutateAsync({ commentId, taskId, input: { content } });
    setEditingCommentId(null);
  };

  const handleDelete = (commentId: string) => {
    return deleteComment.mutateAsync({ commentId, taskId });
  };

  const count = commentsQuery.data?.length ?? 0;

  return (
    <Card className="[--card-spacing:1.375rem]">
      <CardHeader>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          Comments
          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {count}
          </span>
        </h3>
      </CardHeader>

      <CardContent>
        <CommentList
          comments={commentsQuery.data ?? []}
          isLoading={commentsQuery.isLoading}
          isError={commentsQuery.isError}
          onRetry={() => commentsQuery.refetch()}
          currentUserId={user?.id}
          editingCommentId={editingCommentId}
          onStartEdit={setEditingCommentId}
          onCancelEdit={() => setEditingCommentId(null)}
          onEditSubmit={handleEditSubmit}
          onDelete={handleDelete}
          className="max-h-[20rem] overflow-y-auto pr-1"
        />
      </CardContent>

      <CardContent>
        <CommentForm
          mode="create"
          placeholder="Add a comment..."
          submitLabel="Post"
          onSubmit={handleCreate}
        />
      </CardContent>
    </Card>
  );
}
