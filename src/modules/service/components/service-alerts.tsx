"use client";

import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ServiceAlert } from "@/modules/service/types";

export function ServiceAlerts({
  alerts,
  onAction,
}: {
  alerts: ServiceAlert[];
  onAction: (alert: ServiceAlert) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Card key={alert.id} className="flex flex-col gap-3 border-urgent/30 bg-urgent-soft p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-3">
            <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-urgent" />
            <div>
              <p className="text-sm font-semibold text-foreground">{alert.title}</p>
              <p className="text-xs text-muted-foreground">{alert.description}</p>
            </div>
          </div>
          <Button size="sm" className="w-full shrink-0 sm:w-auto" onClick={() => onAction(alert)}>
            {alert.action.label}
          </Button>
        </Card>
      ))}
    </div>
  );
}
