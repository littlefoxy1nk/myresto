"use client";

import { cn } from "@/lib/utils";
import { LIVE_STATE_STYLE } from "@/modules/floorplan/live-state-style";
import type { TableWithLiveState } from "@/modules/floorplan/types";

export function TableShape({
  table,
  selected,
  dragging,
  mergeTarget,
  showReservation,
  onPointerDownCapture,
}: {
  table: TableWithLiveState;
  selected: boolean;
  dragging: boolean;
  /// Une autre table est en train d'être glissée par-dessus celle-ci — un anneau vert
  /// distinct de la sélection, pour annoncer "la déposer ici proposera de fusionner"
  /// avant même de relâcher (voir floor-plan-canvas.tsx, findDropTarget).
  mergeTarget?: boolean;
  /// Aperçu d'un jour : affiche l'heure et le nom de la réservation sur la table.
  showReservation?: boolean;
  onPointerDownCapture?: (e: React.PointerEvent) => void;
}) {
  const style = LIVE_STATE_STYLE[table.liveState];

  return (
    <div
      onPointerDownCapture={onPointerDownCapture}
      className={cn(
        "absolute flex select-none flex-col items-center justify-center border-2 text-xs font-medium shadow-sm transition-shadow",
        table.shape === "round" ? "rounded-full" : "rounded-lg",
        style.fill,
        style.border,
        style.text,
        selected && "ring-2 ring-accent ring-offset-2 ring-offset-background",
        mergeTarget && "ring-2 ring-good ring-offset-2 ring-offset-background",
        dragging ? "cursor-grabbing shadow-lg" : "cursor-grab"
      )}
      style={{ left: table.posX, top: table.posY, width: table.width, height: table.height }}
      data-table-id={table.id}
    >
      <span className="text-sm font-semibold">{table.label}</span>
      {showReservation && table.activeReservation ? (
        <span className="max-w-full truncate px-1 text-[11px] opacity-90">
          {table.activeReservation.time} · {table.activeReservation.customerName}
          {(table.dayReservations?.length ?? 0) > 1 && ` +${table.dayReservations!.length - 1}`}
        </span>
      ) : (
        <span className="opacity-80">{table.capacity} pers.</span>
      )}
    </div>
  );
}
