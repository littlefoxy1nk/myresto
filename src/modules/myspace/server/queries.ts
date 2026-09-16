import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { getCurrentContext } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { TARGET_SHIFTS_RULE_TYPE } from "@/modules/planning/types";
import type { MyDashboard, MyShift, MyTimeOffRequest, MyNotification } from "@/modules/myspace/types";

function fullDayLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/// Vue personnelle d'un membre sur ses propres données — aucune permission requise au-
/// delà d'être connecté : ce n'est jamais la donnée d'un tiers, et chaque rôle (y
/// compris le propriétaire) peut avoir ses propres shifts à consulter. Ne renvoie
/// jamais rien qui dépasse `ctx.membership.id` — voir le filtre systématique ci-dessous.
export async function getMyDashboard(): Promise<MyDashboard> {
  const ctx = await getCurrentContext();
  const membershipId = ctx.membership.id;
  const establishmentId = ctx.establishment.id;

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const [shifts, rule, timeOffRows, notificationRows, unavailableRows] = await Promise.all([
    prisma.shift.findMany({
      where: { membershipId, date: { gte: weekStart, lte: weekEnd }, status: { not: "cancelled" } },
      include: { service: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.schedulingRule.findFirst({ where: { establishmentId, membershipId, type: TARGET_SHIFTS_RULE_TYPE } }),
    prisma.timeOffRequest.findMany({
      where: { membershipId },
      orderBy: { startDate: "desc" },
      take: 10,
    }),
    prisma.notification.findMany({
      where: { membershipId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.availability.findMany({
      where: { membershipId, kind: "unavailable", startTime: null, endTime: null },
      select: { dayOfWeek: true },
    }),
  ]);

  const toMyShift = (s: (typeof shifts)[number]): MyShift => ({
    id: s.id,
    date: toDateKey(s.date),
    dateLabel: fullDayLabel(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    serviceName: s.service?.name ?? null,
    position: s.position,
  });

  const weekShifts = shifts.map(toMyShift);
  const todayKey = toDateKey(today);
  const todayShifts = weekShifts.filter((s) => s.date === todayKey);

  let objective: MyDashboard["objective"] = null;
  if (rule) {
    try {
      const params = JSON.parse(rule.params) as { count?: number };
      if (typeof params.count === "number" && params.count > 0) {
        const planned = weekShifts.length;
        objective = { target: params.count, planned, remaining: Math.max(params.count - planned, 0) };
      }
    } catch {
      objective = null;
    }
  }

  const timeOffRequests: MyTimeOffRequest[] = timeOffRows.map((r) => ({
    id: r.id,
    startDate: toDateKey(r.startDate),
    endDate: toDateKey(r.endDate),
    reason: r.reason,
    status: r.status as MyTimeOffRequest["status"],
    createdAt: r.createdAt.toISOString(),
  }));

  const notifications: MyNotification[] = notificationRows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    linkHref: n.linkHref,
    isRead: n.readAt != null,
    createdAt: n.createdAt.toISOString(),
  }));

  return {
    memberName: `${ctx.user.firstName} ${ctx.user.lastName}`,
    firstName: ctx.user.firstName,
    jobTitle: ctx.membership.jobTitle,
    todayShifts,
    weekShifts,
    weekShiftsCount: weekShifts.length,
    objective,
    timeOffRequests,
    notifications,
    unreadNotificationsCount: notifications.filter((n) => !n.isRead).length,
    hasCode: ctx.user.codeHash != null,
    hasEmail: ctx.user.email != null,
    username: ctx.user.username,
    unavailableDays: unavailableRows.map((r) => r.dayOfWeek),
  };
}

/// Utilisé pour le badge de notifications non lues affiché dans la navigation — une
/// requête légère, séparée du dashboard complet pour ne pas re-fetcher shifts/congés à
/// chaque rendu de layout.
export async function getUnreadNotificationsCount(): Promise<number> {
  const ctx = await getCurrentContext();
  return prisma.notification.count({ where: { membershipId: ctx.membership.id, readAt: null } });
}
