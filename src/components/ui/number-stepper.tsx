"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/// − 2 + : pour choisir un petit nombre sans taper au clavier. Le nombre reste lisible par un formulaire
/// classique grâce à `name` (champ caché) quand le composant est utilisé hors état contrôlé.
export function NumberStepper({
  value,
  onChange,
  min,
  max,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
  className?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const button =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground outline-none transition-all hover:bg-muted active:scale-95 focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40";
  return (
    <div role="group" aria-label={label} className={cn("flex items-center gap-4", className)}>
      <button type="button" className={button} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Moins">
        <Minus size={18} aria-hidden="true" />
      </button>
      <span className="min-w-8 text-center text-2xl font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={button} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Plus">
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
