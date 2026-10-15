"use client";

import { cn } from "@/lib/utils";
import { SHIFT_ZONES, SHIFT_ZONE_LABELS, type ShiftZone } from "@/modules/planning/types";

export type PlanningZoneFilter = "tous" | ShiftZone;

/// 2 affichages (Salle/Cuisine) demandés en plus de la vue complète — partagé entre la
/// vue manager (planning-app.tsx) et la vue simplifiée employé (worker-planning-view),
/// pour ne filtrer qu'à un seul endroit (voir POSITIONS_BY_ZONE, planning/types.ts).
export function PlanningZoneTabs({ value, onChange }: { value: PlanningZoneFilter; onChange: (zone: PlanningZoneFilter) => void }) {
  const options: { value: PlanningZoneFilter; label: string }[] = [
    { value: "tous", label: "Tous" },
    ...SHIFT_ZONES.map((z) => ({ value: z, label: SHIFT_ZONE_LABELS[z] })),
  ];

  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-2xl border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
            value === option.value ? "border-accent bg-accent-soft text-accent" : "border-border bg-card text-foreground hover:bg-muted"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
