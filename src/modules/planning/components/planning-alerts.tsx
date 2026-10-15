"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, AlertCircle, Check, Eye, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanningAlert } from "@/modules/planning/types";
import { dismissPlanningAlert, restorePlanningAlerts } from "@/modules/planning/server/actions";

// Même vocabulaire visuel que les alertes d'Aujourd'hui (urgent / important / watch) —
// pas une réinvention du style pour un module de plus.
const SEVERITY_CONFIG = {
  urgent: { icon: AlertTriangle, bg: "bg-urgent-soft", text: "text-urgent" },
  important: { icon: AlertCircle, bg: "bg-important-soft", text: "text-important" },
  watch: { icon: Eye, bg: "bg-watch-soft", text: "text-watch" },
} as const;

/// Les alertes de la semaine. Un clic sur « OK » la range pour toi (personnel, pour cette semaine seulement) :
/// l'alerte n'est pas supprimée du calcul, et « Rétablir » la ramène.
export function PlanningAlerts({ alerts, weekStart, dismissedCount }: { alerts: PlanningAlert[]; weekStart: string; dismissedCount: number }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const visible = alerts.filter((a) => !hidden.has(a.id));

  function dismiss(id: string) {
    setHidden((prev) => new Set(prev).add(id));
    startTransition(() => dismissPlanningAlert(weekStart, id));
  }

  function restore() {
    setHidden(new Set());
    startTransition(() => restorePlanningAlerts(weekStart));
  }

  const totalDismissed = dismissedCount + hidden.size;
  if (visible.length === 0 && totalDismissed === 0) return null;

  return (
    <div id="alertes" className="scroll-mt-24 space-y-2">
      {visible.map((alert) => {
        const config = SEVERITY_CONFIG[alert.severity];
        const Icon = config.icon;
        return (
          <div key={alert.id} className={cn("flex items-start gap-3 rounded-2xl p-3.5", config.bg)}>
            <Icon size={16} className={cn("mt-0.5 shrink-0", config.text)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-semibold", config.text)}>{alert.title}</p>
              {alert.description && <p className="mt-0.5 text-xs text-muted-foreground">{alert.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(alert.id)}
              title="C'est OK pour moi : ranger cette alerte pour cette semaine"
              className="flex shrink-0 items-center gap-1 rounded-full bg-card/70 px-2.5 py-1 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Check size={13} aria-hidden="true" />
              OK
            </button>
          </div>
        );
      })}
      {totalDismissed > 0 && (
        <button
          type="button"
          onClick={restore}
          className="flex items-center gap-1.5 rounded-full px-1 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Undo2 size={13} aria-hidden="true" />
          {totalDismissed} alerte{totalDismissed > 1 ? "s" : ""} rangée{totalDismissed > 1 ? "s" : ""} — rétablir
        </button>
      )}
    </div>
  );
}
