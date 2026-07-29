import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/utils";

interface UserAvatarProps {
  name: string;
  image?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

// The standard avatar for rendering a TeamOS user (actor, assignee, member,
// etc). Wraps the shadcn/ui Avatar primitive with the one piece of
// TeamOS-specific behavior it needs: falling back to initials when there is
// no image, or when the image fails to load.
export function UserAvatar({ name, image, size = "default", className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
