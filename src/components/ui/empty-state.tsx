import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/// Un écran vide qui reste agréable : une icône douce, une phrase claire, et si possible la suite à donner.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-3xl border border-dashed border-border bg-card/50 px-6 py-10 text-center", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent" aria-hidden="true">
        <Icon size={22} />
      </span>
      <p className="mt-3 text-[15px] font-semibold tracking-tight">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
