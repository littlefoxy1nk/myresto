import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-ink text-ink-foreground shadow-sm hover:opacity-85",
  accent: "bg-accent text-accent-foreground shadow-sm hover:opacity-90",
  secondary: "bg-muted text-foreground hover:bg-border",
  ghost: "hover:bg-muted text-foreground",
  outline: "border border-border bg-card/60 text-foreground hover:bg-muted",
} as const;

const SIZES = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  );
}
