import { redirect } from "next/navigation";
import { startOfWeek, addDays, format, parseISO, isValid } from "date-fns";
import { getCurrentContext } from "@/lib/current-context";
import { getWeekPlanning } from "@/modules/planning/server/queries";
import { PlanningApp } from "@/modules/planning/components/planning-app";

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

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const isCurrentWeek = toDateKey(weekStart) === toDateKey(currentWeekStart);

  return (
    <div className="mx-auto max-w-6xl">
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
