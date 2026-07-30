export interface CommentAuthor {
  id: string;
  name: string;
  image: string | null;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
}
