import { cn, getInitials } from "@/utils";

interface WorkspaceAvatarProps {
  name: string;
  className?: string;
}

export function WorkspaceAvatar({ name, className }: WorkspaceAvatarProps) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground",
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
