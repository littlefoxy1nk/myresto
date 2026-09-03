import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const VARIANTS = {
  urgent: "bg-urgent-soft text-urgent",
  important: "bg-important-soft text-important",
  watch: "bg-watch-soft text-watch",
  good: "bg-good-soft text-good",
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent-soft text-accent",
} as const;

export function Badge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
