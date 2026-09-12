import { AlertTriangle, AlertCircle, Eye } from "lucide-react";
import type { PlanningAlert } from "@/modules/planning/types";

// Même vocabulaire visuel que les alertes d'Aujourd'hui (urgent / important / watch) —
// pas une réinvention du style pour un module de plus.
const SEVERITY_CONFIG = {
  urgent: { icon: AlertTriangle, bg: "bg-urgent-soft", text: "text-urgent" },
  important: { icon: AlertCircle, bg: "bg-important-soft", text: "text-important" },
  watch: { icon: Eye, bg: "bg-watch-soft", text: "text-watch" },
} as const;

export function PlanningAlerts({ alerts }: { alerts: PlanningAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const config = SEVERITY_CONFIG[alert.severity];
        const Icon = config.icon;
        return (
          <div key={alert.id} className={`flex items-start gap-3 rounded-xl p-3 ${config.bg}`}>
            <Icon size={16} className={`mt-0.5 shrink-0 ${config.text}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className={`text-sm font-medium ${config.text}`}>{alert.title}</p>
              {alert.description && <p className="mt-0.5 text-xs text-muted-foreground">{alert.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
