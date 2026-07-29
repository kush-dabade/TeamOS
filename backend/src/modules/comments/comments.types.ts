export type CommentAuthor = {
  id: string;
  name: string;
  image: string | null;
};

export type CommentResponse = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: CommentAuthor;
};

export interface CreateCommentData {
  taskId: string;
  content: string;
}

export interface ListCommentsOptions {
  taskId: string;
}

export interface UpdateCommentData {
  commentId: string;
  content: string;
}

export interface DeleteCommentOptions {
  commentId: string;
}
