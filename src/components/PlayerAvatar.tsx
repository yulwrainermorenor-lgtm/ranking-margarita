import { Player } from "@/lib/types";
import { getInitials, avatarColor, avatarTextColor } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  player: { name: string; photo_url?: string | null };
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-20 w-20 text-2xl",
};

export function PlayerAvatar({ player, size = "md", className }: PlayerAvatarProps) {
  if (player.photo_url) {
    return (
      <img
        src={player.photo_url}
        alt={player.name}
        className={cn(
          "rounded-full object-cover shrink-0 border border-white/20 shadow-sm",
          sizeMap[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-bold shrink-0 shadow-sm transition-transform border border-white/10",
        sizeMap[size],
        className,
      )}
      style={{
        backgroundColor: avatarColor(player.name),
        color: avatarTextColor(player.name),
      }}
      aria-hidden
    >
      {getInitials(player.name)}
    </div>
  );
}
