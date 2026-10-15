"use client";

import Link from "next/link";
import { X, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LIVE_STATE_STYLE } from "@/modules/floorplan/live-state-style";
import type { TableWithLiveState } from "@/modules/floorplan/types";
import { formatMinutes } from "@/modules/service/format";

export function ServiceTableSheet({
  table,
  onClose,
  onMarkArrived,
  onMarkSeated,
  onRelease,
  onMarkReady,
  onOccupy,
}: {
  table: TableWithLiveState;
  onClose: () => void;
  onMarkArrived: (reservationId: string) => void;
  onMarkSeated: (reservationId: string) => void;
  onRelease: (reservationId: string) => void;
  onMarkReady: (tableId: string) => void;
  onOccupy: (tableId: string) => void;
}) {
  const style = LIVE_STATE_STYLE[table.liveState];
  const reservation = table.activeReservation;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto sheet-mobile rounded-t-[28px] border-t border-border bg-card p-5 pb-8 shadow-pop md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:overflow-visible md:rounded-3xl md:border md:pb-5 md:shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold">{table.label}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={style.badge}>{style.label}</Badge>
            <span className="text-xs text-muted-foreground">{table.capacity} pl.</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={16} aria-hidden="true" />
          <span className="sr-only">Fermer</span>
        </button>
      </div>

      {reservation ? (
        <div className="mt-4 rounded-2xl border border-border bg-muted/70 p-3 text-sm">
          <p className="font-medium">{reservation.customerName}</p>
          <p className="text-xs text-muted-foreground">
            {reservation.partySize} pers. · {reservation.time}
            {reservation.minutesFromNow > 0 &&
              (reservation.status === "new" || reservation.status === "confirmed") &&
              ` · dans ${formatMinutes(reservation.minutesFromNow)}`}
          </p>
        </div>
      ) : (
        table.liveState === "available" && (
          <p className="mt-4 text-sm text-muted-foreground">Aucune réservation en ce moment.</p>
        )
      )}

      <div className="mt-4 flex flex-col gap-2">
        {reservation && (reservation.status === "new" || reservation.status === "confirmed") && (
          <Button onClick={() => onMarkArrived(reservation.id)}>Marquer arrivé</Button>
        )}
        {reservation && reservation.status === "arrived" && (
          <Button onClick={() => onMarkSeated(reservation.id)}>Marquer installée</Button>
        )}
        {reservation && (reservation.status === "arrived" || reservation.status === "seated") && (
          <Button variant="secondary" onClick={() => onRelease(reservation.id)}>
            Libérer la table
          </Button>
        )}
        {table.liveState === "cleaning" && <Button onClick={() => onMarkReady(table.id)}>Marquer prête</Button>}
        {table.manualStatus === "unavailable" && (
          <Button onClick={() => onMarkReady(table.id)}>Rendre disponible</Button>
        )}
        {!reservation && table.liveState === "available" && (
          <Button variant="secondary" onClick={() => onOccupy(table.id)}>
            <Users size={14} aria-hidden="true" />
            Rendre occupée
          </Button>
        )}
        {reservation && (
          <Button variant="ghost" asChild>
            <Link href="/reservations">
              <ExternalLink size={14} aria-hidden="true" />
              Voir la réservation
            </Link>
          </Button>
        )}
      </div>

    </div>
  );
}
