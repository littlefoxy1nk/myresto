"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/lib/toast-bus";
import { ZONE_ICON, PRESSURE_DOT_CLASS, PRESSURE_LABEL } from "@/modules/floorplan/components/zone-tabs";
import { cn } from "@/lib/utils";
import { FloorPlanCanvas } from "@/modules/floorplan/components/floor-plan-canvas";
import { ServiceAlerts } from "@/modules/service/components/service-alerts";
import { ServiceNextUp } from "@/modules/service/components/service-next-up";
import { ServiceTimeline } from "@/modules/service/components/service-timeline";
import { ServiceTableSheet } from "@/modules/service/components/service-table-sheet";
import { useAutoRefresh } from "@/modules/service/components/use-auto-refresh";
import { formatMinutes } from "@/modules/service/format";
import { updateReservationStatus, releaseReservationTables } from "@/modules/reservations/server/actions";
import { setTableManualStatus } from "@/modules/floorplan/server/actions";
import type { ServiceSnapshot, ServiceAlert } from "@/modules/service/types";

const REFRESH_INTERVAL_MS = 30_000;

export function ServiceApp({ snapshot }: { snapshot: ServiceSnapshot }) {
  useAutoRefresh(REFRESH_INTERVAL_MS);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Arrivé mais pas encore installé : sans cette liste, la personne "disparaît" du
  // cockpit dès qu'elle quitte "Prochaines arrivées", jusqu'à cliquer sa table une à une.
  const arrivedWaiting = snapshot.timeline.filter((t) => t.status === "arrived");

  async function guarded(action: () => Promise<unknown>, successMessage?: string) {
    try {
      await action();
      if (successMessage) toast(successMessage);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    }
  }

  function handleAlertAction(alert: ServiceAlert) {
    if (alert.action.kind === "release") {
      guarded(() => releaseReservationTables(alert.action.targetId), "Table libérée, prête");
    } else {
      guarded(() => setTableManualStatus(alert.action.targetId, "available"), "Table prête");
    }
  }

  const statusLine =
    snapshot.alerts.length === 0
      ? "Tout est prêt"
      : `${snapshot.alerts.length} point${snapshot.alerts.length > 1 ? "s" : ""} nécessite${snapshot.alerts.length > 1 ? "nt" : ""} votre attention`;

  return (
    <div className="space-y-6">
      {/* En-tête "salle de contrôle" — pas des tuiles KPI, une lecture continue */}
      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {snapshot.currentService
                ? `${snapshot.currentService.name} en cours`
                : snapshot.nextService
                  ? `${snapshot.nextService.name} dans ${formatMinutes(snapshot.nextService.minutesFromNow)}`
                  : "Aucun service en cours"}
            </p>
            <p className={`text-lg font-semibold ${snapshot.alerts.length > 0 ? "text-urgent" : "text-good"}`}>
              {statusLine}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{snapshot.expectedCovers}</span> couvert
          {snapshot.expectedCovers > 1 ? "s" : ""} attendu{snapshot.expectedCovers > 1 ? "s" : ""} ·{" "}
          <span className="font-semibold text-foreground">{snapshot.tablesOccupied}</span> table
          {snapshot.tablesOccupied > 1 ? "s" : ""} occupée{snapshot.tablesOccupied > 1 ? "s" : ""} ·{" "}
          <span className="font-semibold text-foreground">{snapshot.reservationsRemaining}</span> réservation
          {snapshot.reservationsRemaining > 1 ? "s" : ""} en cours ou à venir
          {snapshot.tablesToPrep > 0 && (
            <>
              {" "}
              · <span className="font-semibold text-urgent">{snapshot.tablesToPrep}</span> table
              {snapshot.tablesToPrep > 1 ? "s" : ""} à préparer
            </>
          )}
        </p>
      </Card>

      <ServiceAlerts alerts={snapshot.alerts} onAction={handleAlertAction} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Prochaines arrivées</h2>
        <ServiceNextUp
          entries={snapshot.nextUp}
          onMarkArrived={(id) => guarded(() => updateReservationStatus(id, "arrived"), "Client marqué arrivé")}
        />
      </section>

      {arrivedWaiting.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">En attente d&apos;installation</h2>
          <ServiceNextUp
            entries={arrivedWaiting}
            actionLabel="Installer"
            onMarkArrived={(id) => guarded(() => updateReservationStatus(id, "seated"), "Table installée")}
          />
        </section>
      )}

      {snapshot.zones.length > 0 && (
        <section className="space-y-5">
          <h2 className="text-sm font-semibold">Plan de salle</h2>
          {snapshot.zones.map((zone) => {
            const capacity = zone.tables.reduce((sum, t) => sum + t.capacity, 0);
            const free = zone.tables.filter((t) => t.liveState === "available").length;
            const pressure = snapshot.zonePressure[zone.id];
            const zoneSelectedTable = zone.tables.find((t) => t.id === selectedTableId) ?? null;
            return (
              <div key={zone.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {pressure && (
                    <span
                      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", PRESSURE_DOT_CLASS[pressure])}
                      aria-label={PRESSURE_LABEL[pressure]}
                      title={PRESSURE_LABEL[pressure]}
                    />
                  )}
                  <span aria-hidden="true">{ZONE_ICON[zone.type] ?? "📍"}</span>
                  {zone.name}
                  <span className="text-xs font-normal text-muted-foreground">
                    {free}/{zone.tables.length} libres · {capacity} pl.
                  </span>
                </div>
                {zone.tables.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    Aucune table dans cette zone.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <div className="w-full min-w-0 flex-1">
                      <FloorPlanCanvas
                        fit
                        tables={zone.tables}
                        canEdit={false}
                        selectedTableId={selectedTableId}
                        mergeSelection={new Set()}
                        onSelectTable={setSelectedTableId}
                        onMoveTable={() => {}}
                        onResizeTable={() => {}}
                      />
                    </div>
                    {zoneSelectedTable && (
                      <ServiceTableSheet
                        key={zoneSelectedTable.id}
                        table={zoneSelectedTable}
                        onClose={() => setSelectedTableId(null)}
                        onMarkArrived={(id) => guarded(() => updateReservationStatus(id, "arrived"), "Client marqué arrivé")}
                        onMarkSeated={(id) => guarded(() => updateReservationStatus(id, "seated"), "Table installée")}
                        onRelease={(id) => guarded(() => releaseReservationTables(id), "Table libérée, prête")}
                        onMarkReady={(id) => guarded(() => setTableManualStatus(id, "available"), "Table prête")}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section>
        <button
          onClick={() => setTimelineOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Toutes les réservations du jour
          {timelineOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
        {timelineOpen && (
          <div className="mt-2">
            <ServiceTimeline entries={snapshot.timeline} />
          </div>
        )}
      </section>
    </div>
  );
}
