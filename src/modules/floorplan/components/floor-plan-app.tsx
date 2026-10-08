"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast-bus";
import { ZoneTabs } from "@/modules/floorplan/components/zone-tabs";
import { FloorPlanCanvas } from "@/modules/floorplan/components/floor-plan-canvas";
import { TablePanel } from "@/modules/floorplan/components/table-panel";
import { CreateZoneDialog } from "@/modules/floorplan/components/create-zone-dialog";
import { CreateTableDialog } from "@/modules/floorplan/components/create-table-dialog";
import { WalkInDialog } from "@/modules/service/components/walk-in-dialog";
import { CreateGroupDialog } from "@/modules/floorplan/components/create-group-dialog";
import {
  createZone,
  deleteZone,
  createTable,
  createTablesBulk,
  updateTable,
  deleteTable,
  duplicateTable,
  createTableGroup,
  dissolveTableGroup,
} from "@/modules/floorplan/server/actions";
import type { ZoneWithTables } from "@/modules/floorplan/types";

function reserveHref(
  table: { id: string; zoneId: string },
  dayView: { dateKey: string; startTime: string | null } | null
) {
  const params = new URLSearchParams({ tableId: table.id, zoneId: table.zoneId });
  if (dayView) {
    params.set("date", dayView.dateKey);
    if (dayView.startTime) params.set("time", dayView.startTime);
  }
  return `/reservations/nouvelle?${params.toString()}`;
}

export function FloorPlanApp({
  zones,
  canEdit,
  canCreateReservation,
  canWalkIn,
  dayView = null,
}: {
  zones: ZoneWithTables[];
  canEdit: boolean;
  canCreateReservation: boolean;
  canWalkIn: boolean;
  /// Aperçu en lecture seule d'un autre jour / d'un service (voir getFloorPlanForDay).
  dayView?: { label: string; serviceName: string | null; isToday: boolean; dateKey: string; startTime: string | null } | null;
}) {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(zones[0]?.id ?? null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const [showCreateZone, setShowCreateZone] = useState(false);
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [confirmDeleteTableId, setConfirmDeleteTableId] = useState<string | null>(null);
  const [confirmDeleteZoneId, setConfirmDeleteZoneId] = useState<string | null>(null);
  const [walkInTableId, setWalkInTableId] = useState<string | null>(null);

  const activeZone = zones.find((z) => z.id === activeZoneId) ?? zones[0] ?? null;
  const selectedTable = activeZone?.tables.find((t) => t.id === selectedTableId) ?? null;

  const freeSuffix = dayView ? (dayView.serviceName ? "sur ce service" : "sur la journée") : "en ce moment";

  const zoneTotals = useMemo(() => {
    if (!activeZone) return { capacity: 0, free: 0 };
    return {
      capacity: activeZone.tables.reduce((s, t) => s + t.capacity, 0),
      free: activeZone.tables.filter((t) => t.liveState === "available").length,
    };
  }, [activeZone]);

  async function guarded(action: () => Promise<unknown>, successMessage?: string) {
    try {
      await action();
      if (successMessage) toast(successMessage);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    }
  }

  function handleSelectTable(id: string) {
    if (mergeMode) {
      setMergeSelection((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedTableId(id);
    }
  }

  function exitMergeMode() {
    setMergeMode(false);
    setMergeSelection(new Set());
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.key === "Escape") {
        if (mergeMode) exitMergeMode();
        else setSelectedTableId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && canEdit && selectedTableId && !mergeMode) {
        e.preventDefault();
        setConfirmDeleteTableId(selectedTableId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mergeMode, selectedTableId, canEdit]);

  if (!activeZone) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-sm font-medium">Aucune zone pour l&apos;instant</p>
        <p className="text-sm text-muted-foreground">
          Créez une première zone (salle, terrasse, bar…) pour commencer à placer vos tables.
        </p>
        {canEdit && (
          <Button onClick={() => setShowCreateZone(true)}>
            <Plus size={15} aria-hidden="true" />
            Créer une zone
          </Button>
        )}
        <CreateZoneDialog
          open={showCreateZone}
          onOpenChange={setShowCreateZone}
          onCreate={(name, type) => guarded(() => createZone({ name, type }), "Zone créée")}
        />
      </Card>
    );
  }

  const selectedTableIds = [...mergeSelection];
  const suggestedCapacity = activeZone.tables
    .filter((t) => selectedTableIds.includes(t.id))
    .reduce((s, t) => s + t.capacity, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ZoneTabs
          zones={zones}
          activeZoneId={activeZone.id}
          canEdit={canEdit}
          onSelect={(id) => {
            setActiveZoneId(id);
            setSelectedTableId(null);
            exitMergeMode();
          }}
          onCreateZone={() => setShowCreateZone(true)}
          onDeleteZone={(id) => setConfirmDeleteZoneId(id)}
        />
        {canEdit && (
          <div className="flex items-center gap-2">
            {mergeMode ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {mergeSelection.size} table{mergeSelection.size > 1 ? "s" : ""} sélectionnée{mergeSelection.size > 1 ? "s" : ""}
                </span>
                <Button size="sm" variant="secondary" onClick={exitMergeMode}>
                  <X size={14} aria-hidden="true" />
                  Annuler
                </Button>
                <Button size="sm" disabled={mergeSelection.size < 2} onClick={() => setShowCreateGroup(true)}>
                  Fusionner
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setShowCreateTable(true)}>
                <Plus size={15} aria-hidden="true" />
                Table
              </Button>
            )}
          </div>
        )}
      </div>

      {dayView && (
        <p className="rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-2.5 text-sm">
          <span className="font-medium text-accent">
            Aperçu · {dayView.label}
            {dayView.serviceName && ` · ${dayView.serviceName}`}
          </span>{" "}
          <span className="text-muted-foreground">— lecture seule, les réservations de ce créneau sont affichées sur les tables.</span>
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {activeZone.tables.length} table{activeZone.tables.length > 1 ? "s" : ""} · {zoneTotals.capacity} places ·{" "}
        {zoneTotals.free} libre{zoneTotals.free > 1 ? "s" : ""} {freeSuffix}
      </p>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {activeZone.tables.length === 0 ? (
          <Card className="flex flex-1 flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium">Cette zone est vide</p>
            <p className="text-sm text-muted-foreground">Ajoutez votre première table pour commencer à dessiner le plan.</p>
            {canEdit && (
              <Button onClick={() => setShowCreateTable(true)}>
                <Plus size={15} aria-hidden="true" />
                Ajouter une table
              </Button>
            )}
          </Card>
        ) : (
          <div className="w-full min-w-0 flex-1">
            <FloorPlanCanvas
              tables={activeZone.tables}
              canEdit={canEdit}
              showReservations={!!dayView}
              selectedTableId={selectedTableId}
              mergeSelection={mergeSelection}
              onSelectTable={handleSelectTable}
              onMoveTable={(id, posX, posY) => guarded(() => updateTable({ id, posX, posY }))}
              onResizeTable={(id, width, height) => guarded(() => updateTable({ id, width, height }))}
              onDropOnTable={
                mergeMode
                  ? undefined
                  : (draggedId, targetId) => {
                      setMergeSelection(new Set([draggedId, targetId]));
                      setShowCreateGroup(true);
                    }
              }
            />
          </div>
        )}

        {selectedTable && !mergeMode && (
          <TablePanel
            key={selectedTable.id}
            table={selectedTable}
            canEdit={canEdit}
            canCreateReservation={canCreateReservation}
            reserveHref={reserveHref(selectedTable, dayView)}
            onWalkIn={canWalkIn && !dayView ? () => setWalkInTableId(selectedTable.id) : undefined}
            zones={zones.map((z) => ({ id: z.id, name: z.name }))}
            onClose={() => setSelectedTableId(null)}
            onPatch={(patch) => guarded(() => updateTable({ id: selectedTable.id, ...patch }))}
            onDelete={() => setConfirmDeleteTableId(selectedTable.id)}
            onDuplicate={() => guarded(() => duplicateTable(selectedTable.id), "Table dupliquée")}
            onDissolveGroup={(groupId) => guarded(() => dissolveTableGroup(groupId), "Groupe dissous")}
            onStartMerge={() => {
              setMergeMode(true);
              setMergeSelection(new Set([selectedTable.id]));
              setSelectedTableId(null);
            }}
          />
        )}
      </div>

      <CreateZoneDialog
        open={showCreateZone}
        onOpenChange={setShowCreateZone}
        onCreate={(name, type) => guarded(() => createZone({ name, type }), "Zone créée")}
      />
      {walkInTableId && (
        <WalkInDialog
          key={walkInTableId}
          open
          onOpenChange={(open) => !open && setWalkInTableId(null)}
          tableId={walkInTableId}
          tableCapacity={activeZone.tables.find((t) => t.id === walkInTableId)?.capacity ?? 2}
        />
      )}
      <CreateTableDialog
        open={showCreateTable}
        onOpenChange={setShowCreateTable}
        onCreate={(label, capacity, shape) =>
          guarded(() => createTable({ zoneId: activeZone.id, label, capacity, shape }), "Table créée")
        }
        onCreateBulk={(count, labelPrefix, capacity, shape) =>
          guarded(
            () => createTablesBulk({ zoneId: activeZone.id, count, labelPrefix, capacity, shape }),
            `${count} tables créées`
          )
        }
      />
      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={(open) => {
          setShowCreateGroup(open);
          if (!open) exitMergeMode();
        }}
        tableLabels={activeZone.tables.filter((t) => selectedTableIds.includes(t.id)).map((t) => t.label)}
        suggestedCapacity={suggestedCapacity}
        onCreate={async (combinedCapacity, label) => {
          await guarded(
            () => createTableGroup({ tableIds: selectedTableIds, combinedCapacity, label: label || undefined }),
            "Tables fusionnées"
          );
          exitMergeMode();
        }}
      />
      <ConfirmDialog
        open={!!confirmDeleteTableId}
        onOpenChange={(open) => !open && setConfirmDeleteTableId(null)}
        title="Supprimer cette table ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (!confirmDeleteTableId) return;
          guarded(() => deleteTable(confirmDeleteTableId), "Table supprimée");
          setSelectedTableId(null);
        }}
      />
      <ConfirmDialog
        open={!!confirmDeleteZoneId}
        onOpenChange={(open) => !open && setConfirmDeleteZoneId(null)}
        title="Supprimer cette zone ?"
        description={
          (zones.find((z) => z.id === confirmDeleteZoneId)?.tables.length ?? 0) > 0
            ? `Ses ${zones.find((z) => z.id === confirmDeleteZoneId)?.tables.length} table(s) seront supprimées avec elle. Cette action est irréversible.`
            : "Cette action est irréversible."
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (!confirmDeleteZoneId) return;
          guarded(() => deleteZone(confirmDeleteZoneId), "Zone supprimée");
          setActiveZoneId(null);
        }}
      />
    </div>
  );
}
