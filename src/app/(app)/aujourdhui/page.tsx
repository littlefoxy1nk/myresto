import { getCurrentContext } from "@/lib/current-context";
import { isModuleEnabled } from "@/lib/modules";
import { Badge } from "@/components/ui/badge";
import { getTodayServicePlan } from "@/modules/service/server/queries";
import { TodayServicePlan } from "@/modules/service/components/today-service-plan";
import { getCountdownEvents, getTodayOverview } from "@/modules/today/server/queries";
import { TodaySummaryCard } from "@/modules/today/components/today-summary-card";
import { CountdownWidget } from "@/modules/today/components/countdown-widget";
import { upcomingEvents } from "@/modules/today/countdown";

/// Aujourd'hui : la date, le(s) prochain(s) service(s) avec couverts et équipe, un compte à rebours au choix,
/// puis le plan de toutes les salles du service.
export default async function AujourdhuiPage() {
  const ctx = await getCurrentContext();
  const now = new Date();
  const canSeePlan = ctx.can("service.run") && isModuleEnabled(ctx.establishment.disabledModules, "floorplan");

  const [overview, plan, events] = await Promise.all([
    getTodayOverview(ctx.establishment.id),
    canSeePlan ? getTodayServicePlan(ctx.establishment.id) : Promise.resolve(null),
    getCountdownEvents(ctx.establishment.id),
  ]);

  const dateText = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const dateLabel = dateText.charAt(0).toUpperCase() + dateText.slice(1);
  const canSeePlanning = ctx.can("schedule.view") && isModuleEnabled(ctx.establishment.disabledModules, "planning");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{dateLabel}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {ctx.establishment.name}
          {ctx.establishment.isDemo && <Badge variant="accent">Données de démonstration</Badge>}
        </p>
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

      {plan && <TodayServicePlan plan={plan} />}
    </div>
  );
}
