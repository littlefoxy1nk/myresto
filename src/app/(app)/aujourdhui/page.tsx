import { getCurrentContext } from "@/lib/current-context";
import { isModuleEnabled } from "@/lib/modules";
import { Badge } from "@/components/ui/badge";
import { getTodayServicePlan } from "@/modules/service/server/queries";
import { TodayServicePlan } from "@/modules/service/components/today-service-plan";
import { getCountdownEvents, getTodayOverview, getTodayReservationHits } from "@/modules/today/server/queries";
import { ReservationFinder } from "@/modules/today/components/reservation-finder";
import { TodaySummaryCard } from "@/modules/today/components/today-summary-card";
import { CountdownWidget } from "@/modules/today/components/countdown-widget";
import { upcomingEvents } from "@/modules/today/countdown";

function greeting(now: Date): string {
  const hour = now.getHours();
  return hour >= 5 && hour < 18 ? "Bonjour" : "Bonsoir";
}

/// Aujourd'hui : la date, le(s) prochain(s) service(s) avec couverts et équipe, un compte à rebours au choix,
/// puis le plan de toutes les salles du service.
export default async function AujourdhuiPage() {
  const ctx = await getCurrentContext();
  const now = new Date();
  const canSeePlan = ctx.can("service.run") && isModuleEnabled(ctx.establishment.disabledModules, "floorplan");

  const [overview, plan, events, reservationHits] = await Promise.all([
    getTodayOverview(ctx.establishment.id),
    canSeePlan ? getTodayServicePlan(ctx.establishment.id) : Promise.resolve(null),
    getCountdownEvents(ctx.establishment.id),
    getTodayReservationHits(ctx.establishment.id),
  ]);

  const dateText = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const dateLabel = dateText.charAt(0).toUpperCase() + dateText.slice(1);
  const canSeePlanning = ctx.can("schedule.view") && isModuleEnabled(ctx.establishment.disabledModules, "planning");

  return (
    <div className="stagger mx-auto max-w-6xl space-y-6">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
          {dateLabel}
          {ctx.establishment.isDemo && <Badge variant="accent">Données de démonstration</Badge>}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
          {greeting(now)} {ctx.user.firstName}
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodaySummaryCard overview={overview} canSeePlanning={canSeePlanning} />
        </div>
        <CountdownWidget
          events={upcomingEvents(events, now)}
          canManage={ctx.can("settings.manage") || ctx.can("schedule.edit")}
        />
      </div>

      {plan ? (
        <TodayServicePlan plan={plan} reservations={reservationHits} />
      ) : (
        reservationHits.length > 0 && <ReservationFinder reservations={reservationHits} />
      )}
    </div>
  );
}
