"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { toast } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";
import { ZONE_ICON } from "@/modules/floorplan/components/zone-tabs";
import { FloorPlanCanvas } from "@/modules/floorplan/components/floor-plan-canvas";
import { LIVE_STATE_STYLE } from "@/modules/floorplan/live-state-style";
import { ServiceTableSheet } from "@/modules/service/components/service-table-sheet";
import { useAutoRefresh } from "@/modules/service/components/use-auto-refresh";
import { formatMinutes } from "@/modules/service/format";
import { occupyTable, updateReservationStatus, releaseReservationTables } from "@/modules/reservations/server/actions";
import { setTableManualStatus } from "@/modules/floorplan/server/actions";
import type { TodayServicePlan } from "@/modules/service/types";

const REFRESH_INTERVAL_MS = 30_000;
const LEGEND = ["available", "soon", "reserved", "occupied", "cleaning"] as const;

/// Toutes les salles du service d'un coup d'œil, sur un seul écran. Un clic sur une table ouvre ses actions
/// (arrivé, installé, libérer, prête, client sans réservation).
export function TodayServicePlan({ plan }: { plan: TodayServicePlan }) {
  useAutoRefresh(REFRESH_INTERVAL_MS);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  async function guarded(action: () => Promise<unknown>, successMessage?: string) {
    try {
      await action();
      if (successMessage) toast(successMessage);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    }
  }

  if (plan.mode === "none" || !plan.service) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-medium">Plus de service aujourd&apos;hui</p>
        <p className="mt-1 text-sm text-muted-foreground">Le plan des salles réapparaît ici avec le prochain service.</p>
      </Card>
    );
  }

  const allTables = plan.zones.flatMap((z) => z.tables);
  const selected = allTables.find((t) => t.id === selectedTableId) ?? null;
  const count = (states: string[]) => allTables.filter((t) => states.includes(t.liveState)).length;
  const upcoming = plan.mode === "upcoming";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">
          {plan.service.name}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {upcoming ? `commence dans ${formatMinutes(plan.service.minutesFromNow)}` : "en cours"}
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{count(["available"])}</span> libres ·{" "}
          <span className="font-semibold text-foreground">{count(["occupied"])}</span> occupées ·{" "}
          <span className="font-semibold text-foreground">{count(["reserved", "soon"])}</span> réservées
          {count(["cleaning"]) > 0 && (
            <>
              {" "}
              · <span className="font-semibold text-urgent">{count(["cleaning"])}</span> à préparer
            </>
          )}
        </p>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Légende des couleurs">
        {LEGEND.filter((s) => !(upcoming && (s === "occupied" || s === "soon" || s === "cleaning"))).map((state) => {
          const style = LIVE_STATE_STYLE[state];
          return (
            <li key={state} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("inline-block h-3 w-3 rounded border-2", style.fill, style.border)} />
              {style.label}
            </li>
          );
        })}
      </ul>

      {plan.zones.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Aucune salle n&apos;est encore dessinée dans le plan de salle.</Card>
      ) : (
        <div className={cn("grid grid-cols-1 gap-4", plan.zones.length > 1 && "md:grid-cols-2", plan.zones.length > 2 && "xl:grid-cols-3")}>
          {plan.zones.map((zone) => {
            const free = zone.tables.filter((t) => t.liveState === "available").length;
            return (
              <Card key={zone.id} className="min-w-0 space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span aria-hidden="true">{ZONE_ICON[zone.type] ?? "📍"}</span>
                  {zone.name}
                  <span className="text-xs font-normal text-muted-foreground">
                    {free}/{zone.tables.length} libres
                  </span>
                </div>
                {zone.tables.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">Aucune table dans cette salle.</p>
                ) : (
                  <FloorPlanCanvas
                    fit
                    tables={zone.tables}
                    canEdit={false}
                    showReservations={upcoming}
                    selectedTableId={selectedTableId}
                    mergeSelection={new Set()}
                    onSelectTable={setSelectedTableId}
                    onMoveTable={() => {}}
                    onResizeTable={() => {}}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="md:fixed md:bottom-6 md:right-6 md:z-50">
          <ServiceTableSheet
            key={selected.id}
            table={selected}
            onClose={() => setSelectedTableId(null)}
            onMarkArrived={(id) => guarded(() => updateReservationStatus(id, "arrived"), "Client marqué arrivé")}
            onMarkSeated={(id) => guarded(() => updateReservationStatus(id, "seated"), "Table installée")}
            onRelease={(id) => guarded(() => releaseReservationTables(id), "Table libérée, prête")}
            onMarkReady={(id) => guarded(() => setTableManualStatus(id, "available"), "Table prête")}
            onOccupy={(id) => guarded(() => occupyTable(id))}
          />
        </div>
      )}
    </div>
  );
}
