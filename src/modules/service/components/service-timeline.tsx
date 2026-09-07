"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TimelineEntry } from "@/modules/service/types";

const STATUS_LABEL: Record<string, string> = {
  new: "Nouvelle",
  confirmed: "Confirmée",
  arrived: "Arrivée",
  seated: "Installée",
  completed: "Terminée",
  no_show: "No-show",
};

const STATUS_VARIANT: Record<string, "neutral" | "good" | "important" | "urgent" | "accent"> = {
  new: "important",
  confirmed: "accent",
  arrived: "good",
  seated: "good",
  completed: "neutral",
  no_show: "urgent",
};

export function ServiceTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune réservation aujourd&apos;hui.</p>;
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.reservationId}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-opacity",
            entry.isPast ? "opacity-45" : "bg-muted/60"
          )}
        >
          <span className="w-12 shrink-0 font-medium tabular-nums">{entry.time}</span>
          <span className="min-w-0 flex-1 truncate">
            {entry.customerName} · {entry.partySize} pers.
            {entry.tableLabels.length > 0 && ` · ${entry.tableLabels.join(" + ")}`}
          </span>
          <Badge variant={STATUS_VARIANT[entry.status] ?? "neutral"} className="shrink-0">
            {STATUS_LABEL[entry.status] ?? entry.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
