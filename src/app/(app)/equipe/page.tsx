import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startOfWeek, endOfWeek } from "date-fns";
import { UserPlus } from "lucide-react";

export default async function EquipePage() {
  const ctx = await getCurrentContext();
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {memberships.length} membre{memberships.length > 1 ? "s" : ""}
          </p>
        </div>
        {ctx.can("staff.manage") && (
          <Button asChild size="sm">
            <Link href="/equipe/nouveau">
              <UserPlus size={15} aria-hidden="true" />
              Ajouter
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {memberships.map((m) => {
          const hoursThisWeek = m.shifts.reduce((sum, s) => {
            const [sh, sm] = s.startTime.split(":").map(Number);
            const [eh, em] = s.endTime.split(":").map(Number);
            return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
          }, 0);
          const target = m.weeklyHoursTarget ?? 0;

          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {m.user.firstName.charAt(0)}
                  {m.user.lastName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user.firstName} {m.user.lastName}
                  </p>
                  {m.jobTitle && m.jobTitle !== m.role.label && (
                    <p className="truncate text-xs text-muted-foreground">{m.jobTitle}</p>
                  )}
                </div>
                <Badge variant="neutral">{m.role.label}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {m.shifts.length} service{m.shifts.length > 1 ? "s" : ""} cette semaine
                </span>
                {target > 0 && (
                  <span>
                    {hoursThisWeek.toFixed(0)}h / {target}h
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
