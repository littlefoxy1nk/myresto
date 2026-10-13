import { redirect } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getCurrentContext } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { getFloorPlan, getFloorPlanForDay } from "@/modules/floorplan/server/queries";
import { FloorPlanApp } from "@/modules/floorplan/components/floor-plan-app";
import { PlanDayPicker } from "@/modules/floorplan/components/plan-day-picker";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export default async function PlanDeSallePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; service?: string }>;
}) {
  const ctx = await getCurrentContext();
  if (!ctx.can("floorplan.view")) redirect("/aujourdhui");

  const { date: dateParam, service: serviceParam } = await searchParams;
  const todayKey = toDateKey(new Date());
  const parsed = dateParam && DATE_KEY.test(dateParam) ? new Date(`${dateParam}T00:00:00`) : null;
  const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  const dateKey = date ? toDateKey(date) : todayKey;

  // Aujourd'hui sans service choisi = le plan live, éditable. Tout le reste est un aperçu.
  const isLive = dateKey === todayKey && !serviceParam;

  const day = isLive
    ? null
    : await getFloorPlanForDay(ctx.establishment.id, date ?? new Date(), serviceParam ?? null);
  const zones = day ? day.zones : await getFloorPlan(ctx.establishment.id);
  const services = day
    ? day.services
    : (await getFloorPlanForDay(ctx.establishment.id, new Date(), null)).services;

  const dayView = day
    ? {
        label: format(new Date(`${dateKey}T00:00:00`), "EEEE d MMMM", { locale: fr }),
        serviceName: day.service?.name ?? null,
        dateKey,
        startTime: day.service?.startTime ?? null,
        isToday: dateKey === todayKey,
      }
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan de salle</h1>
        <p className="mt-1 text-sm text-muted-foreground">{ctx.establishment.name}</p>
      </div>

      <PlanDayPicker dateKey={dateKey} todayKey={todayKey} services={services} serviceId={day?.service?.id ?? null} />

      <FloorPlanApp
        zones={zones}
        canEdit={!dayView && ctx.can("floorplan.edit")}
        canCreateReservation={ctx.can("reservations.edit")}
        canWalkIn={ctx.can("reservations.edit") || ctx.can("service.run")}
        canMergeDay={!!dayView && dateKey >= todayKey && ctx.can("floorplan.edit")}
        dayView={dayView}
      />
    </div>
  );
}
