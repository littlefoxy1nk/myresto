"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { ZoneTabs } from "@/modules/floorplan/components/zone-tabs";
import { FloorPlanCanvas } from "@/modules/floorplan/components/floor-plan-canvas";
import { ServiceAlerts } from "@/modules/service/components/service-alerts";
import { ServiceNextUp } from "@/modules/service/components/service-next-up";
import { ServiceTimeline } from "@/modules/service/components/service-timeline";
import { ServiceTableSheet } from "@/modules/service/components/service-table-sheet";
import { useAutoRefresh } from "@/modules/service/components/use-auto-refresh";
import { formatMinutes } from "@/modules/service/format";
import { updateReservationStatus, releaseReservationTables } from "@/modules/reservations/server/actions";
import { setTableManualStatus } from "@/modules/floorplan/server/actions";
import { ZoneAssignmentsSummary } from "@/modules/staff/components/zone-assignments-summary";
import { AssignmentManagerDialog } from "@/modules/staff/components/assignment-manager-dialog";
import type { ZoneAssignmentsResult } from "@/modules/staff/server/assignments";
import type { ServiceSnapshot, ServiceAlert } from "@/modules/service/types";

const REFRESH_INTERVAL_MS = 30_000;

export function ServiceApp({
  snapshot,
  assignments,
}: {
  snapshot: ServiceSnapshot;
  assignments: ZoneAssignmentsResult;
}) {
  useAutoRefresh(REFRESH_INTERVAL_MS);

  const [activeZoneId, setActiveZoneId] = useState<string | null>(snapshot.zones[0]?.id ?? null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const activeZone = snapshot.zones.find((z) => z.id === activeZoneId) ?? snapshot.zones[0] ?? null;
  const selectedTable = activeZone?.tables.find((t) => t.id === selectedTableId) ?? null;
  const responsibleForSelectedTable = selectedTable
    ? assignments.zones.find((z) => z.zoneId === selectedTable.zoneId)?.members.map((m) => `${m.firstName} ${m.lastName}`) ?? []
    : [];

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
      guarded(() => releaseReservationTables(alert.action.targetId), "Table libérée, en nettoyage");
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

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users2 size={14} aria-hidden="true" />
            Équipe du service
          </h2>
          {assignments.canEdit && (
            <AssignmentManagerDialog
              zones={assignments.zones}
              assignableMembers={assignments.assignableMembers}
              trigger={
                <Button size="sm" variant="ghost">
                  Modifier
                </Button>
              }
            />
          )}
        </div>
        <ZoneAssignmentsSummary zones={assignments.zones} />
      </section>

      {activeZone && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Plan de salle</h2>
          <ZoneTabs
            zones={snapshot.zones}
            activeZoneId={activeZone.id}
            canEdit={false}
            onSelect={setActiveZoneId}
            onCreateZone={() => {}}
            onDeleteZone={() => {}}
          />
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="w-full min-w-0 flex-1">
              <FloorPlanCanvas
                tables={activeZone.tables}
                canEdit={false}
                selectedTableId={selectedTableId}
                mergeSelection={new Set()}
                onSelectTable={setSelectedTableId}
                onMoveTable={() => {}}
                onResizeTable={() => {}}
              />
            </div>
            {selectedTable && (
              <ServiceTableSheet
                key={selectedTable.id}
                table={selectedTable}
                responsibleNames={responsibleForSelectedTable}
                onClose={() => setSelectedTableId(null)}
                onMarkArrived={(id) => guarded(() => updateReservationStatus(id, "arrived"), "Client marqué arrivé")}
                onMarkSeated={(id) => guarded(() => updateReservationStatus(id, "seated"), "Table installée")}
                onRelease={(id) => guarded(() => releaseReservationTables(id), "Table libérée, en nettoyage")}
                onMarkReady={(id) => guarded(() => setTableManualStatus(id, "available"), "Table prête")}
              />
            )}
          </div>
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
