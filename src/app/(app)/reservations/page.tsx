import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { ReservationActionButton } from "@/modules/reservations/components/reservation-action-button";
import { ReservationRowActions } from "@/modules/reservations/components/reservation-row-actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startOfDay, endOfDay, format } from "date-fns";
import { Plus } from "lucide-react";
import { RESERVATION_STATUS_LABEL, RESERVATION_STATUS_VARIANT } from "@/modules/reservations/status";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default async function ReservationsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("reservations.view")) redirect("/aujourdhui");

  const today = new Date();
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const reservations = await prisma.reservation.findMany({
    where: {
      establishmentId: ctx.establishment.id,
      date: { gte: startOfDay(today), lte: endOfDay(today) },
    },
    include: { tables: { include: { table: true } } },
    orderBy: { time: "asc" },
  });

  const canEdit = ctx.can("reservations.edit");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Réservations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {reservations.length} réservation{reservations.length > 1 ? "s" : ""} aujourd&apos;hui ·{" "}
            {reservations.reduce((s, r) => s + r.partySize, 0)} couverts
          </p>
        </div>
        {canEdit && (
          <Button asChild size="sm">
            <Link href="/reservations/nouvelle">
              <Plus size={15} aria-hidden="true" />
              Nouvelle
            </Link>
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {reservations.map((r) => {
          const meta = [
            `${r.partySize} pers.`,
            r.tables.length > 0 ? r.tables.map((t) => t.table.label).join(" + ") : null,
          ]
            .filter(Boolean)
            .join(" · ");
          const isPastTime = timeToMinutes(r.time) < nowMinutes;
          const isOpen = r.status === "new" || r.status === "confirmed";

          return (
            <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
              {/* Ligne 1 : heure + nom */}
              <div className="flex items-baseline gap-2 sm:w-48 sm:shrink-0">
                <span className="shrink-0 text-sm font-semibold tabular-nums">{r.time}</span>
                {r.customerId ? (
                  <Link href={`/clients/${r.customerId}`} className="truncate text-sm font-medium text-accent hover:underline">
                    {r.customerName}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium">{r.customerName}</span>
                )}
              </div>

              {/* Ligne 2 : personnes + table + statut */}
              <div className="flex flex-wrap items-center gap-2 sm:flex-1">
                <span className="text-xs text-muted-foreground">{meta}</span>
                <Badge variant={RESERVATION_STATUS_VARIANT[r.status]}>{RESERVATION_STATUS_LABEL[r.status]}</Badge>
                {r.specialRequests && (
                  <span className="text-xs text-muted-foreground">· {r.specialRequests}</span>
                )}
              </div>

              {/* Ligne 3 : actions */}
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {r.status === "new" && (
                    <ReservationActionButton reservationId={r.id} targetStatus="confirmed" label="Confirmer" />
                  )}
                  {(r.status === "confirmed" || r.status === "arrived") && (
                    <ReservationActionButton reservationId={r.id} targetStatus="seated" label="Installer" />
                  )}
                  {isOpen && (
                    <ReservationRowActions
                      reservationId={r.id}
                      showNoShow={isPastTime}
                      editInitial={{
                        partySize: r.partySize,
                        date: format(r.date, "yyyy-MM-dd"),
                        time: r.time,
                        durationMinutes: r.durationMinutes,
                        notes: r.notes ?? "",
                        specialRequests: r.specialRequests ?? "",
                      }}
                    />
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {reservations.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Aucune réservation aujourd&apos;hui.
          </Card>
        )}
      </div>
    </div>
  );
}
