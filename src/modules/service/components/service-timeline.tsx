"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TimelineEntry } from "@/modules/service/types";
import { RESERVATION_STATUS_LABEL, RESERVATION_STATUS_VARIANT } from "@/modules/reservations/status";

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
          <Badge variant={RESERVATION_STATUS_VARIANT[entry.status] ?? "neutral"} className="shrink-0">
            {RESERVATION_STATUS_LABEL[entry.status] ?? entry.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
