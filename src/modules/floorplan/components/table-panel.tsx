"use client";

import Link from "next/link";
import { useState } from "react";
import { X, Copy, Trash2, Link2, Link2Off, CalendarPlus, UserPlus, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isMovable } from "@/modules/reservations/move";
import { LIVE_STATE_STYLE } from "@/modules/floorplan/live-state-style";
import { TABLE_SHAPES, TABLE_MANUAL_STATUSES, type TableWithLiveState, type TableShape, type TableManualStatus } from "@/modules/floorplan/types";

const SHAPE_LABELS: Record<TableShape, string> = { square: "Carrée", round: "Ronde", rect: "Rectangulaire" };
const STATUS_LABELS: Record<TableManualStatus, string> = {
  available: "Disponible",
  cleaning: "Nettoyage",
  unavailable: "Indisponible",
};

export function TablePanel({
  table,
  canEdit,
  canCreateReservation,
  reserveHref,
  onWalkIn,
  onMoveReservation,
  zones,
  onClose,
  onPatch,
  onDelete,
  onDuplicate,
  onDissolveGroup,
  onStartMerge,
}: {
  table: TableWithLiveState;
  canEdit: boolean;
  canCreateReservation: boolean;
  /// Lien "réserver pour plus tard" (date/heure du plan affiché déjà préremplies).
  reserveHref: string;
  /// Présent seulement sur le plan live : installer tout de suite un client sans réservation.
  onWalkIn?: () => void;
  /// Présent si l'utilisateur peut changer une réservation de table.
  onMoveReservation?: (reservationId: string) => void;
  zones: { id: string; name: string }[];
  onClose: () => void;
  onPatch: (patch: Partial<{ label: string; capacity: number; shape: TableShape; zoneId: string; status: TableManualStatus }>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDissolveGroup: (groupId: string) => void;
  onStartMerge: () => void;
}) {
  const [label, setLabel] = useState(table.label);
  const style = LIVE_STATE_STYLE[table.liveState];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-5 shadow-xl md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:overflow-visible md:rounded-2xl md:border md:shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold">{table.label}</p>
          <Badge variant={style.badge} className="mt-1">
            {style.label}
          </Badge>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={16} aria-hidden="true" />
          <span className="sr-only">Fermer</span>
        </button>
      </div>

      {table.liveState !== "unavailable" && (onWalkIn || canCreateReservation) && (
        <div className="mt-4 space-y-2">
          {onWalkIn && (table.liveState === "available" || table.liveState === "soon") && (
            <Button size="sm" className="w-full" onClick={onWalkIn}>
              <UserPlus size={14} aria-hidden="true" />
              Installer un client maintenant
            </Button>
          )}
          {canCreateReservation && (
            <Button asChild size="sm" variant={onWalkIn ? "secondary" : "primary"} className="w-full">
              <Link href={reserveHref}>
                <CalendarPlus size={14} aria-hidden="true" />
                Réserver cette table
              </Link>
            </Button>
          )}
        </div>
      )}

      {(table.dayReservations ?? (table.activeReservation ? [table.activeReservation] : [])).map((r) => (
        <div key={r.id} className="mt-4 rounded-xl border border-border bg-muted p-3 text-sm">
          <Link
            href="/reservations"
            className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <p className="font-medium">{r.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {r.partySize} pers. · {r.time}
              {r.minutesFromNow > 0 && ` · dans ${formatMinutes(r.minutesFromNow)}`}
            </p>
          </Link>
          {onMoveReservation && isMovable(r.status) && (
            <button
              type="button"
              onClick={() => onMoveReservation(r.id)}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent outline-none hover:underline focus-visible:underline"
            >
              <ArrowRightLeft size={13} aria-hidden="true" />
              Changer de table
            </button>
          )}
        </div>
      ))}

      {table.group && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/40 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-accent">
            <Link2 size={14} aria-hidden="true" />
            Fusionnée · {table.group.combinedCapacity} pers.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Avec {table.group.tableIds.length - 1} autre(s) table(s)</p>
          {canEdit && (
            <button
              onClick={() => onDissolveGroup(table.group!.id)}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
            >
              <Link2Off size={13} aria-hidden="true" />
              Dissoudre le groupe
            </button>
          )}
        </div>
      )}

      {canEdit ? (
        <div className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="panel-label" className="text-xs font-medium text-muted-foreground">
              Nom / numéro
            </label>
            <input
              id="panel-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => label.trim() && label !== table.label && onPatch({ label: label.trim() })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="panel-capacity" className="text-xs font-medium text-muted-foreground">
                Capacité
              </label>
              <input
                id="panel-capacity"
                type="number"
                min={1}
                max={30}
                defaultValue={table.capacity}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v && v !== table.capacity) onPatch({ capacity: v });
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="panel-shape" className="text-xs font-medium text-muted-foreground">
                Forme
              </label>
              <select
                id="panel-shape"
                value={table.shape}
                onChange={(e) => onPatch({ shape: e.target.value as TableShape })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {TABLE_SHAPES.map((s) => (
                  <option key={s} value={s}>
                    {SHAPE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="panel-zone" className="text-xs font-medium text-muted-foreground">
              Zone
            </label>
            <select
              id="panel-zone"
              value={table.zoneId}
              onChange={(e) => onPatch({ zoneId: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="panel-status" className="text-xs font-medium text-muted-foreground">
              Statut
            </label>
            <select
              id="panel-status"
              value={table.manualStatus}
              onChange={(e) => onPatch({ status: e.target.value as TableManualStatus })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {TABLE_MANUAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="secondary" onClick={onDuplicate}>
              <Copy size={14} aria-hidden="true" />
              Dupliquer
            </Button>
            {!table.group && (
              <Button size="sm" variant="secondary" onClick={onStartMerge}>
                <Link2 size={14} aria-hidden="true" />
                Fusionner
              </Button>
            )}
            <Button size="sm" variant="outline" className="border-urgent text-urgent hover:bg-urgent-soft" onClick={onDelete}>
              <Trash2 size={14} aria-hidden="true" />
              Supprimer
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
          <p>{table.capacity} personnes · {SHAPE_LABELS[table.shape]}</p>
        </div>
      )}
    </div>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
