import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays } from "date-fns";
import { getCurrentContext } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { TARGET_SHIFTS_RULE_TYPE } from "@/modules/planning/types";
import { getMyReplacementOpportunities } from "@/modules/replacement/server/queries";
import type { MyAvailabilityService, MyCoverageRequest, MyDashboard, MyShift, MyTimeOffRequest, MyNotification } from "@/modules/myspace/types";

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

  const [shifts, rule, timeOffRows, notificationRows, serviceDefinitions, usualAvailabilityRows, oneOffRows, openReplacementRequests, replacementOpportunities, coverageRequestRows] =
    await Promise.all([
      prisma.shift.findMany({
        // "planned" = brouillon pas encore publié (voir publishWeekSchedule) — jamais
        // visible par la personne elle-même avant que le manager l'ait relu.
        where: { membershipId, date: { gte: weekStart, lte: weekEnd }, status: { notIn: ["cancelled", "planned"] } },
        include: { service: true },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
      prisma.schedulingRule.findFirst({ where: { establishmentId, membershipId, type: TARGET_SHIFTS_RULE_TYPE } }),
      prisma.timeOffRequest.findMany({
        where: { membershipId },
        include: { documents: true },
        orderBy: { startDate: "desc" },
        take: 10,
      }),
      prisma.notification.findMany({
        where: { membershipId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.serviceDefinition.findMany({ where: { establishmentId } }),
      prisma.availability.findMany({
        where: { membershipId, kind: "preferred", serviceId: { not: null }, date: null },
        select: { dayOfWeek: true, serviceId: true },
      }),
      prisma.availability.findMany({
        where: { membershipId, kind: "preferred", serviceId: { not: null }, date: { gte: weekStart, lte: weekEnd } },
        select: { id: true, date: true, serviceId: true },
      }),
      prisma.replacementRequest.findMany({
        where: { requestedById: membershipId, status: "open" },
        select: { shiftId: true },
      }),
      getMyReplacementOpportunities(),
      prisma.coverageRequest.findMany({
        where: { membershipId, status: "pending" },
        include: { service: true },
        orderBy: { date: "asc" },
      }),
    ]);

  const openReplacementShiftIds = new Set(openReplacementRequests.map((r) => r.shiftId));

  const toMyShift = (s: (typeof shifts)[number]): MyShift => ({
    id: s.id,
    date: toDateKey(s.date),
    dateLabel: fullDayLabel(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    serviceName: s.service?.name ?? null,
    position: s.position,
    hasOpenReplacementRequest: openReplacementShiftIds.has(s.id),
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
    kind: r.kind as MyTimeOffRequest["kind"],
    createdAt: r.createdAt.toISOString(),
    document: r.documents[0] ? { id: r.documents[0].id, originalName: r.documents[0].originalName } : null,
  }));

  const notifications: MyNotification[] = notificationRows.map((n) => ({
    id: n.id,
    type: n.type,
    severity: n.severity as MyNotification["severity"],
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
    replacementOpportunities,
    objective,
    timeOffRequests,
    notifications,
    unreadNotificationsCount: notifications.filter((n) => !n.isRead).length,
    hasCode: ctx.user.codeHash != null,
    hasEmail: ctx.user.email != null,
    username: ctx.user.username,
    employmentType: ctx.membership.employmentType as MyDashboard["employmentType"],
    availabilityServices: serviceDefinitions.map(
      (s): MyAvailabilityService => ({ id: s.id, name: s.name, daysOfWeek: s.daysOfWeek.split(",").map(Number) })
    ),
    usualAvailabilityCells: usualAvailabilityRows.map((r) => ({ dayOfWeek: r.dayOfWeek, serviceId: r.serviceId! })),
    oneOffAvailability: oneOffRows.map((r) => ({ id: r.id, date: toDateKey(r.date!), serviceId: r.serviceId! })),
    currentWeekDates: Array.from({ length: 7 }, (_, i) => toDateKey(addDays(weekStart, i))),
    coverageRequests: coverageRequestRows.map(
      (r): MyCoverageRequest => ({
        id: r.id,
        date: toDateKey(r.date),
        dateLabel: fullDayLabel(r.date),
        serviceName: r.service?.name ?? null,
        startTime: r.startTime,
        endTime: r.endTime,
        position: r.position,
      })
    ),
  };
}

/// Alimente la clochette de notifications affichée sur chaque page (voir
/// src/app/(app)/layout.tsx) — une requête légère, séparée du dashboard complet pour ne
/// pas re-fetcher shifts/congés/disponibilités à chaque rendu de layout.
export async function getNotificationBellData(): Promise<{ notifications: MyNotification[]; unreadCount: number }> {
  const ctx = await getCurrentContext();
  const rows = await prisma.notification.findMany({
    where: { membershipId: ctx.membership.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const notifications: MyNotification[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    severity: n.severity as MyNotification["severity"],
    title: n.title,
    body: n.body,
    linkHref: n.linkHref,
    isRead: n.readAt != null,
    createdAt: n.createdAt.toISOString(),
  }));
  const unreadCount = await prisma.notification.count({ where: { membershipId: ctx.membership.id, readAt: null } });
  return { notifications, unreadCount };
}
