import { redirect } from "next/navigation";
import { isPlanningView } from "@/modules/planning/periods";
import { requireModule } from "@/lib/module-guard";
import { startOfWeek, addDays, format, parseISO, isValid } from "date-fns";
import { getCurrentContext } from "@/lib/current-context";
import { getWeekPlanning } from "@/modules/planning/server/queries";
import { PlanningApp } from "@/modules/planning/components/planning-app";
import { WorkerPlanningView } from "@/modules/planning/components/worker-planning-view";
import { getReplacementRequests } from "@/modules/replacement/server/queries";
import { AssignReplacementControl } from "@/modules/replacement/components/assign-replacement-control";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function toDateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const ctx = await getCurrentContext();
  requireModule(ctx, "planning");
  if (!ctx.can("schedule.view")) redirect("/aujourdhui");

  const { week } = await searchParams;
  const requested = week ? parseISO(week) : new Date();
  const anchor = isValid(requested) ? requested : new Date();
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });

  const data = await getWeekPlanning(ctx.establishment.id, weekStart);
  const replacementRequests = ctx.can("schedule.edit") ? await getReplacementRequests(ctx.establishment.id) : [];

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const isCurrentWeek = toDateKey(weekStart) === toDateKey(currentWeekStart);

  const weekNavProps = {
    prevWeekHref: `/planning?week=${toDateKey(addDays(weekStart, -7))}`,
    nextWeekHref: `/planning?week=${toDateKey(addDays(weekStart, 7))}`,
    currentWeekHref: "/planning",
    isCurrentWeek,
  };

  if (!data.canEdit) {
    return (
      <div className="stagger mx-auto max-w-6xl space-y-6">
        <WorkerPlanningView data={data}
        {...weekNavProps}
      />
      </div>
    );
  }

  const serviceCount = ctx.can("settings.manage")
    ? await prisma.serviceDefinition.count({ where: { establishmentId: ctx.establishment.id } })
    : 0;

  return (
    <div className="stagger mx-auto max-w-6xl space-y-6">
      <PlanningApp
        afterHeader={
          <>
            {ctx.can("settings.manage") && serviceCount <= 1 && (
              <p className="rounded-2xl border border-accent/30 bg-accent-soft/40 px-4 py-2.5 text-sm">
                <span className="font-medium text-accent">Définis tes services</span>{" "}
                <span className="text-muted-foreground">
                  (ex : 12h, 18h, 20h30) pour que le planning, le plan de salle et les réservations suivent tes vrais horaires.
                </span>{" "}
                <Link href="/parametres?tab=etablissement#services" className="font-medium text-accent underline underline-offset-2">
                  Ouvrir les paramètres
                </Link>
              </p>
            )}
            {replacementRequests.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-bold tracking-tight">Remplacements en attente</h2>
                <div className="space-y-2">
                  {replacementRequests.map((r) => (
                    <Card key={r.id} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{r.requestedByName}</span>
                        <span className="text-sm text-muted-foreground">
                          {r.dateLabel} · {r.startTime}–{r.endTime}
                        </span>
                        <Badge variant="neutral">
                          {r.candidates.filter((c) => c.hasVolunteered).length} volontaire
                          {r.candidates.filter((c) => c.hasVolunteered).length > 1 ? "s" : ""}
                        </Badge>
                        {r.reason && <span className="text-xs text-muted-foreground">· {r.reason}</span>}
                      </div>
                      <AssignReplacementControl requestId={r.id} candidates={r.candidates} />
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        }
        data={data}
        view={isPlanningView(ctx.establishment.planningView) ? ctx.establishment.planningView : "service"} {...weekNavProps} />
    </div>
  );
}
