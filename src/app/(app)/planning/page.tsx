import { redirect } from "next/navigation";
import { startOfWeek, addDays, format, parseISO, isValid } from "date-fns";
import { getCurrentContext } from "@/lib/current-context";
import { getWeekPlanning } from "@/modules/planning/server/queries";
import { PlanningApp } from "@/modules/planning/components/planning-app";
import { getReplacementRequests } from "@/modules/replacement/server/queries";
import { AssignReplacementControl } from "@/modules/replacement/components/assign-replacement-control";
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
  if (!ctx.can("schedule.view")) redirect("/aujourdhui");

  const { week } = await searchParams;
  const requested = week ? parseISO(week) : new Date();
  const anchor = isValid(requested) ? requested : new Date();
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });

  const data = await getWeekPlanning(ctx.establishment.id, weekStart);
  const replacementRequests = ctx.can("schedule.edit") ? await getReplacementRequests(ctx.establishment.id) : [];

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const isCurrentWeek = toDateKey(weekStart) === toDateKey(currentWeekStart);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {replacementRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Remplacements en attente</h2>
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
      <PlanningApp
        data={data}
        prevWeekHref={`/planning?week=${toDateKey(addDays(weekStart, -7))}`}
        nextWeekHref={`/planning?week=${toDateKey(addDays(weekStart, 7))}`}
        currentWeekHref="/planning"
        isCurrentWeek={isCurrentWeek}
      />
    </div>
  );
}
