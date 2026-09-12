import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addDays, format } from "date-fns";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { computeWorkloadSummary } from "@/modules/workload/compute";
import {
  computeShiftDurationHours,
  computeDemandLevel,
  computePlanningAlerts,
  detectOverlappingShiftIds,
} from "@/modules/planning/compute";
import type {
  PlanningDayService,
  PlanningMember,
  PlanningServiceDefinition,
  PlanningShift,
  WeekPlanningResult,
} from "@/modules/planning/types";

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function dayLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("fr-BE", { weekday: "short", day: "numeric", month: "short" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fullDayLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/// Assemble la semaine de planning : équipe, shifts, congés approuvés et demande
/// attendue par service (déléguée à computeWorkloadSummary — jamais recalculée ici).
/// `weekStart` doit être un lundi normalisé à minuit (voir page.tsx).
export async function getWeekPlanning(establishmentId: string, weekStart: Date): Promise<WeekPlanningResult> {
  const ctx = await getCurrentContext();
  if (!ctx.can("schedule.view")) throw new ForbiddenError("schedule.view");

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rangeStart = startOfDay(weekStart);
  const rangeEnd = endOfDay(days[6]);

  const [memberships, shifts, services, timeOffs, reservations, capacityAgg] = await Promise.all([
    prisma.membership.findMany({
      where: { establishmentId, status: "active" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shift.findMany({
      where: { establishmentId, date: { gte: rangeStart, lte: rangeEnd }, status: { not: "cancelled" } },
      include: { service: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.serviceDefinition.findMany({ where: { establishmentId } }),
    prisma.timeOffRequest.findMany({
      where: { establishmentId, status: "approved", startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } },
    }),
    prisma.reservation.findMany({
      where: { establishmentId, date: { gte: rangeStart, lte: rangeEnd }, status: { notIn: ["cancelled", "no_show"] } },
    }),
    prisma.restaurantTable.aggregate({ where: { establishmentId }, _sum: { capacity: true } }),
  ]);

  const totalCapacity = capacityAgg._sum.capacity ?? 0;

  const members: PlanningMember[] = memberships.map((m) => ({
    membershipId: m.id,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    jobTitle: m.jobTitle,
    weeklyHoursTarget: m.weeklyHoursTarget,
  }));

  const weekDays = days.map(toDateKey);
  const dayLabels: Record<string, string> = {};
  for (const d of days) dayLabels[toDateKey(d)] = dayLabel(d);

  // Congés approuvés qui couvrent chaque jour de la semaine, indexés pour un lookup O(1).
  const absentOn = new Map<string, Set<string>>(); // dateKey -> Set<membershipId>
  for (const d of days) {
    const dateKey = toDateKey(d);
    const dStart = startOfDay(d);
    const dEnd = endOfDay(d);
    const set = new Set<string>();
    for (const t of timeOffs) {
      if (t.startDate <= dEnd && t.endDate >= dStart) set.add(t.membershipId);
    }
    absentOn.set(dateKey, set);
  }

  // Chevauchements : uniquement entre shifts d'une même personne le même jour.
  const shiftsByMemberDay = new Map<string, { id: string; startTime: string; endTime: string }[]>();
  for (const s of shifts) {
    const key = `${s.membershipId}|${toDateKey(s.date)}`;
    const list = shiftsByMemberDay.get(key) ?? [];
    list.push({ id: s.id, startTime: s.startTime, endTime: s.endTime });
    shiftsByMemberDay.set(key, list);
  }
  const overlappingIds = new Set<string>();
  for (const list of shiftsByMemberDay.values()) {
    for (const id of detectOverlappingShiftIds(list)) overlappingIds.add(id);
  }

  const planningShifts: PlanningShift[] = shifts.map((s) => {
    const dateKey = toDateKey(s.date);
    return {
      id: s.id,
      membershipId: s.membershipId,
      date: dateKey,
      startTime: s.startTime,
      endTime: s.endTime,
      position: s.position,
      serviceId: s.serviceId,
      serviceName: s.service?.name ?? null,
      status: s.status,
      hasOverlap: overlappingIds.has(s.id),
      isAbsentConflict: absentOn.get(dateKey)?.has(s.membershipId) ?? false,
    };
  });

  const totalHoursByMember: Record<string, number> = {};
  for (const s of shifts) {
    totalHoursByMember[s.membershipId] =
      (totalHoursByMember[s.membershipId] ?? 0) + computeShiftDurationHours(s.startTime, s.endTime);
  }
  const totalTeamHours = Object.values(totalHoursByMember).reduce((a, b) => a + b, 0);

  const planningServices: PlanningServiceDefinition[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    daysOfWeek: s.daysOfWeek.split(",").map(Number),
  }));

  // Demande attendue par jour × service actif ce jour-là — tout le calcul de couverts /
  // réservations est délégué à computeWorkloadSummary (module workload, Mission 4),
  // jamais réécrit ici.
  const dayServices: PlanningDayService[] = [];
  for (const d of days) {
    const isoDay = d.getDay() === 0 ? 7 : d.getDay();
    const dateKey = toDateKey(d);
    const servicesToday = services.filter((s) => s.daysOfWeek.split(",").map(Number).includes(isoDay));

    for (const service of servicesToday) {
      const reservationsForService = reservations.filter(
        (r) => toDateKey(r.date) === dateKey && r.serviceId === service.id
      );
      const summary = computeWorkloadSummary(
        reservationsForService.map((r) => ({ time: r.time, partySize: r.partySize, zoneId: null })),
        []
      );
      const staffForService = shifts.filter((s) => toDateKey(s.date) === dateKey && s.serviceId === service.id);
      const absentSet = absentOn.get(dateKey);
      const absentScheduled = staffForService
        .filter((s) => absentSet?.has(s.membershipId))
        .map((s) => {
          const member = memberships.find((m) => m.id === s.membershipId);
          return {
            membershipId: s.membershipId,
            name: member ? `${member.user.firstName} ${member.user.lastName}` : "?",
          };
        })
        // une même personne peut avoir plusieurs shifts sur ce service — on ne la liste qu'une fois
        .filter((v, i, arr) => arr.findIndex((x) => x.membershipId === v.membershipId) === i);

      dayServices.push({
        date: dateKey,
        dateLabel: fullDayLabel(d),
        serviceId: service.id,
        serviceName: service.name,
        covers: summary.totalCovers,
        reservationsCount: summary.totalReservations,
        staffCount: staffForService.length,
        floorStaffCount: staffForService.filter((s) => s.position === "salle").length,
        demandLevel: computeDemandLevel(summary.totalCovers, totalCapacity),
        absentScheduled,
      });
    }
  }

  const alerts = computePlanningAlerts(dayServices);

  return {
    weekStart: toDateKey(weekStart),
    weekDays,
    dayLabels,
    members,
    shifts: planningShifts,
    services: planningServices,
    dayServices,
    alerts,
    totalHoursByMember,
    totalTeamHours,
    canEdit: ctx.can("schedule.edit"),
  };
}
