import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { ReservationActionButton } from "@/modules/reservations/components/reservation-action-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startOfDay, endOfDay } from "date-fns";
import { Plus } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  new: "Nouvelle",
  confirmed: "Confirmée",
  arrived: "Arrivée",
  seated: "Installée",
  completed: "Terminée",
  cancelled: "Annulée",
  no_show: "No-show",
};

const STATUS_VARIANT: Record<string, "neutral" | "good" | "important" | "urgent" | "accent"> = {
  new: "important",
  confirmed: "accent",
  arrived: "good",
  seated: "good",
  completed: "neutral",
  cancelled: "neutral",
  no_show: "urgent",
};

export default async function ReservationsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("reservations.view")) redirect("/aujourdhui");

  const today = new Date();
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

          return (
            <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
              {/* Ligne 1 : heure + nom */}
              <div className="flex items-baseline gap-2 sm:w-48 sm:shrink-0">
                <span className="shrink-0 text-sm font-semibold tabular-nums">{r.time}</span>
                <span className="truncate text-sm font-medium">{r.customerName}</span>
              </div>

              {/* Ligne 2 : personnes + table + statut */}
              <div className="flex flex-wrap items-center gap-2 sm:flex-1">
                <span className="text-xs text-muted-foreground">{meta}</span>
                <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                {r.specialRequests && (
                  <span className="text-xs text-muted-foreground">· {r.specialRequests}</span>
                )}
              </div>

              {/* Ligne 3 : action principale */}
              {canEdit && r.status === "new" && (
                <ReservationActionButton
                  reservationId={r.id}
                  targetStatus="confirmed"
                  label="Confirmer"
                  className="w-full sm:w-auto"
                />
              )}
              {canEdit && (r.status === "confirmed" || r.status === "arrived") && (
                <ReservationActionButton
                  reservationId={r.id}
                  targetStatus="seated"
                  label="Installer"
                  className="w-full sm:w-auto"
                />
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
