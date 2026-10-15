import Link from "next/link";
import { requireModule } from "@/lib/module-guard";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { ReservationRowActions } from "@/modules/reservations/components/reservation-row-actions";
import { ReservationDayNav } from "@/modules/reservations/components/reservation-day-nav";
import { ConfirmationToggle } from "@/modules/reservations/components/confirmation-toggle";
import {
  ChooseTableButton,
  ConfirmAndNotifyButton,
  DayMessageButton,
  RowMessageButton,
} from "@/modules/reservations/components/reservation-row-extras";
import type { MessageRecipient } from "@/modules/reservations/components/message-dialog";
import { ReservationActionButton } from "@/modules/reservations/components/reservation-action-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startOfDay, endOfDay, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus } from "lucide-react";
import { toDateKey } from "@/lib/utils";
import { isoWeekday, timeToMinutes } from "@/lib/time";
import { assignService, eveningEnd, servicesOfReservation } from "@/modules/service/spans";
import { BlockEveningToggle } from "@/modules/reservations/components/block-evening-toggle";
import { RESERVATION_STATUS_LABEL, RESERVATION_STATUS_VARIANT } from "@/modules/reservations/status";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; service?: string }>;
}) {
  const ctx = await getCurrentContext();
  requireModule(ctx, "reservations");
  if (!ctx.can("reservations.view")) redirect("/aujourdhui");

  const { date: dateParam, service: serviceParam } = await searchParams;
  const now = new Date();
  const todayKey = toDateKey(now);
  const parsed = dateParam && DATE_KEY.test(dateParam) ? new Date(`${dateParam}T00:00:00`) : null;
  const day = parsed && !Number.isNaN(parsed.getTime()) ? parsed : startOfDay(now);
  const dateKey = toDateKey(day);
  const isToday = dateKey === todayKey;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const [allReservations, allServices] = await Promise.all([
    prisma.reservation.findMany({
      where: { establishmentId: ctx.establishment.id, date: { gte: startOfDay(day), lte: endOfDay(day) } },
      include: { tables: { include: { table: true } } },
      orderBy: { time: "asc" },
    }),
    prisma.serviceDefinition.findMany({ where: { establishmentId: ctx.establishment.id }, orderBy: { startTime: "asc" } }),
  ]);

  const weekday = isoWeekday(day);
  const dayServices = allServices
    .filter((s) => s.daysOfWeek.split(",").map(Number).includes(weekday))
    .map((s) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime }));
  const service = dayServices.find((s) => s.id === serviceParam) ?? null;

  // Chaque réservation est rangée dans le service qui contient son heure de début (21h → « de 20h30 à 22h »),
  // et n'apparaît dans les suivants que si on les a bloqués ("bloquer aussi le service suivant", "toute la soirée").
  const reservations = service
    ? allReservations.filter((r) => servicesOfReservation(dayServices, r).some((s) => s.id === service.id))
    : allReservations;
  const active = reservations.filter((r) => r.status !== "cancelled" && r.status !== "no_show");

  const canEdit = ctx.can("reservations.edit");
  const dayLabel = format(day, "EEEE d MMMM", { locale: fr });
  const restaurantName = ctx.establishment.name;
  const servicesForForms = allServices.map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    days: s.daysOfWeek.split(",").map(Number),
  }));

  const toRecipient = (r: (typeof reservations)[number]): MessageRecipient => ({
    id: r.id,
    customerName: r.customerName,
    partySize: r.partySize,
    time: r.time,
    phone: r.customerPhone,
    email: r.customerEmail,
    confirmationState: r.confirmationState as MessageRecipient["confirmationState"],
  });
  const askable = active
    .filter((r) => r.status === "new" || r.status === "confirmed")
    .map(toRecipient);

  const pendingRequests = allReservations.filter((r) => r.source === "online" && r.status === "new").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Réservations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length} réservation{active.length > 1 ? "s" : ""} {isToday ? "aujourd'hui" : `le ${dayLabel}`}
            {service && ` · ${service.name}`} · {active.reduce((s, r) => s + r.partySize, 0)} couverts
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <DayMessageButton recipients={askable} dateLabel={dayLabel} restaurantName={restaurantName} />
          )}
          {canEdit && (
            <Button asChild size="sm">
              <Link href={isToday ? "/reservations/nouvelle" : `/reservations/nouvelle?date=${dateKey}`}>
                <Plus size={15} aria-hidden="true" />
                Nouvelle
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ReservationDayNav
        dateKey={dateKey}
        todayKey={todayKey}
        services={dayServices}
        serviceId={service?.id ?? null}
      />

      {pendingRequests > 0 && (
        <p className="rounded-xl border border-important/30 bg-important-soft/60 px-4 py-2.5 text-sm text-important">
          {pendingRequests} demande{pendingRequests > 1 ? "s" : ""} en ligne à traiter ce jour-là : choisis une table puis
          confirme.
        </p>
      )}

      <div className="space-y-2">
        {reservations.map((r) => {
          const hasTables = r.tables.length > 0;
          const meta = [`${r.partySize} pers.`, hasTables ? r.tables.map((t) => t.table.label).join(" + ") : null]
            .filter(Boolean)
            .join(" · ");
          const isPastTime = isToday && timeToMinutes(r.time) < nowMinutes;
          const isOpen = r.status === "new" || r.status === "confirmed";
          const recipient = toRecipient(r);
          const isRequest = r.source === "online" && r.status === "new";
          const eveningUntil = eveningEnd(dayServices, r.time);

          return (
            <Card key={r.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
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

              <div className="flex flex-wrap items-center gap-2 sm:flex-1">
                <span className="text-xs text-muted-foreground">{meta}</span>
                <Badge variant={RESERVATION_STATUS_VARIANT[r.status]}>{RESERVATION_STATUS_LABEL[r.status]}</Badge>
                {isRequest && <Badge variant="important">Demande en ligne</Badge>}
                {dayServices.length > 1 && (
                  <span className="text-xs text-muted-foreground">{assignService(dayServices, r.time)?.name}</span>
                )}
                {r.spansNextService && <Badge variant="neutral">2 services</Badge>}
                {r.blocksEvening && <Badge variant="neutral">Toute la soirée</Badge>}
                {!hasTables && isOpen && <span className="text-xs text-muted-foreground">sans table</span>}
                {r.specialRequests && <span className="text-xs text-muted-foreground">· {r.specialRequests}</span>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isOpen && (
                  <ConfirmationToggle
                    reservationId={r.id}
                    state={r.confirmationState as "none" | "asked" | "confirmed"}
                    editable={canEdit}
                  />
                )}
                {canEdit && (
                  <>
                    {isOpen && (r.customerPhone || r.customerEmail) && (
                      <RowMessageButton recipient={recipient} dateLabel={dayLabel} restaurantName={restaurantName} />
                    )}
                    {isOpen && !hasTables && <ChooseTableButton reservationId={r.id} />}
                    {(r.status === "new" || r.status === "confirmed") && hasTables && (
                      <ConfirmAndNotifyButton
                        recipient={recipient}
                        status={r.status}
                        dateLabel={dayLabel}
                        restaurantName={restaurantName}
                      />
                    )}
                    {(r.status === "confirmed" || r.status === "arrived") && hasTables && (
                      <ReservationActionButton reservationId={r.id} targetStatus="seated" label="Installer" />
                    )}
                    {isOpen && (
                      <ReservationRowActions
                        reservationId={r.id}
                        showNoShow={isPastTime}
                        services={servicesForForms}
                        editInitial={{
                          partySize: r.partySize,
                          date: format(r.date, "yyyy-MM-dd"),
                          time: r.time,
                          durationMinutes: r.durationMinutes,
                          notes: r.notes ?? "",
                          specialRequests: r.specialRequests ?? "",
                          spansNextService: r.spansNextService,
                          blocksEvening: r.blocksEvening,
                        }}
                      />
                    )}
                  </>
                )}
              </div>
              </div>
              {canEdit && isOpen && hasTables && (eveningUntil || r.blocksEvening) && (
                <div className="mt-2 border-t border-border pt-2 sm:pl-[12.5rem]">
                  <BlockEveningToggle
                    reservationId={r.id}
                    checked={r.blocksEvening}
                    until={eveningUntil ?? "la fermeture"}
                  />
                </div>
              )}
            </Card>
          );
        })}
        {reservations.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Aucune réservation {isToday ? "aujourd'hui" : `le ${dayLabel}`}
            {service && ` pour le ${service.name.toLowerCase()}`}.
          </Card>
        )}
      </div>
    </div>
  );
}
