"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { PLANNING_VIEWS, type PlanningView } from "@/modules/planning/periods";
import { setPlanningView } from "@/modules/planning/server/actions";

/// Choix de l'affichage du planning : une ligne par service, ou juste Midi et Soir. L'affichage change tout de
/// suite ; le choix est retenu pour l'établissement.
export function PlanningViewTabs({ value, onChange }: { value: PlanningView; onChange: (view: PlanningView) => void }) {
  const [pending, setPending] = useState(false);

  async function choose(view: PlanningView) {
    if (view === value || pending) return;
    const before = value;
    onChange(view);
    setPending(true);
    try {
      await setPlanningView(view);
    } catch (err) {
      onChange(before);
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer ce choix.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Affichage du planning">
      <span className="text-xs text-muted-foreground">Afficher</span>
      <div className="flex gap-1.5">
        {PLANNING_VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={value === v.key}
            onClick={() => choose(v.key)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              value === v.key ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
