"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/modules/service/format";
import type { TimelineEntry } from "@/modules/service/types";

export function ServiceNextUp({
  entries,
  onMarkArrived,
}: {
  entries: TimelineEntry[];
  onMarkArrived: (reservationId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">Aucune arrivée prévue pour le moment.</Card>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <Card key={entry.reservationId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-baseline gap-2 sm:w-24 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {entry.minutesFromNow <= 0 ? "Maintenant" : `Dans ${formatMinutes(entry.minutesFromNow)}`}
            </p>
            <p className="text-xs text-muted-foreground">{entry.time}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{entry.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {entry.partySize} pers.
              {entry.tableLabels.length > 0 && ` · ${entry.tableLabels.join(" + ")}`}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => onMarkArrived(entry.reservationId)}
          >
            Arrivé
          </Button>
        </Card>
      ))}
    </div>
  );
}
