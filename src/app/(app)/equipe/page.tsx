import Link from "next/link";
import { requireModule } from "@/lib/module-guard";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startOfWeek, endOfWeek } from "date-fns";
import { CalendarDays, UserPlus } from "lucide-react";
import { AvatarFigure } from "@/components/ui/avatar-figure";
import { parseAvatar } from "@/lib/avatar";
import { computeShiftDurationHours } from "@/modules/planning/compute";

export default async function EquipePage() {
  const ctx = await getCurrentContext();
  requireModule(ctx, "staff");
  if (!ctx.can("staff.view")) redirect("/aujourdhui");

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const memberships = await prisma.membership.findMany({
    where: { establishmentId: ctx.establishment.id, status: "active" },
    include: {
      user: true,
      role: true,
      shifts: { where: { date: { gte: weekStart, lte: weekEnd } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="stagger mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {memberships.length} membre{memberships.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ctx.can("schedule.view") && (
            <Button asChild size="sm" variant="secondary">
              <Link href="/planning">
                <CalendarDays size={15} aria-hidden="true" />
                Planning
              </Link>
            </Button>
          )}
          {ctx.can("staff.manage") && (
            <Button asChild size="sm">
              <Link href="/equipe/nouveau">
                <UserPlus size={15} aria-hidden="true" />
                Ajouter
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {memberships.map((m) => {
          const hoursThisWeek = m.shifts.reduce((sum, s) => sum + computeShiftDurationHours(s.startTime, s.endTime), 0);
          const target = m.weeklyHoursTarget ?? 0;

          return (
            <Link key={m.id} href={`/equipe/${m.id}`} className="group rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <Card className="p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-pop">
                <div className="flex items-center gap-3.5">
                  <AvatarFigure config={parseAvatar(m.user.avatarJson, m.user.id)} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold tracking-tight">
                      {m.user.firstName} {m.user.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.jobTitle && m.jobTitle !== m.role.label ? `${m.jobTitle} · ` : ""}
                      {m.shifts.length} service{m.shifts.length > 1 ? "s" : ""} cette semaine
                    </p>
                  </div>
                  <Badge variant="accent">{m.role.label}</Badge>
                </div>
                {target > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Heures cette semaine</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {hoursThisWeek.toFixed(0)}h / {target}h
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(hoursThisWeek)}>
                      <div
                        className={hoursThisWeek > target ? "h-full rounded-full bg-important" : "h-full rounded-full bg-accent"}
                        style={{ width: `${Math.min(100, (hoursThisWeek / target) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
