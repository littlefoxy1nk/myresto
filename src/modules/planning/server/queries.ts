import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addDays, format } from "date-fns";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { computeWorkloadSummary } from "@/modules/workload/compute";
import {
  computeShiftDurationHours,
  computeDemandLevel,
  computePlanningAlerts,
  computeRhAlerts,
  computeWeeklyLimitAlerts,
  evaluateShift,
} from "@/modules/planning/compute";
import type {
  AvailabilityRow,
  PlanningAlert,
  PlanningDayService,
  PlanningMember,
  PlanningServiceDefinition,
  PlanningShift,
  ShiftConflictLevel,
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

const CONFLICT_RANK: Record<ShiftConflictLevel, number> = { ok: 0, warning: 1, conflict: 2 };

/// Assemble la semaine de planning : équipe, shifts (évalués un par un via evaluateShift
/// — disponibilités, congés, chevauchements), et demande attendue par service (déléguée
/// à computeWorkloadSummary — jamais recalculée ici). `weekStart` doit être un lundi
/// normalisé à minuit (voir page.tsx).
export async function getWeekPlanning(establishmentId: string, weekStart: Date): Promise<WeekPlanningResult> {
  const ctx = await getCurrentContext();
  if (!ctx.can("schedule.view")) throw new ForbiddenError("schedule.view");

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rangeStart = startOfDay(weekStart);
  const rangeEnd = endOfDay(days[6]);

  const [memberships, shifts, services, timeOffs, reservations, capacityAgg, availabilities] = await Promise.all([
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
    // Récurrentes (par jour de semaine), pas de filtre de date — un établissement a un
    // volume de disponibilités négligeable, pas besoin de les scoper à la semaine.
    prisma.availability.findMany({ where: { establishmentId } }),
  ]);

  const totalCapacity = capacityAgg._sum.capacity ?? 0;

  const members: PlanningMember[] = memberships.map((m) => ({
    membershipId: m.id,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    jobTitle: m.jobTitle,
    weeklyHoursTarget: m.weeklyHoursTarget,
    maxShiftsPerWeek: m.maxShiftsPerWeek,
  }));

  const weekDays = days.map(toDateKey);
  const dayLabels: Record<string, string> = {};
  for (const d of days) dayLabels[toDateKey(d)] = dayLabel(d);

  const availabilitiesByMember: Record<string, AvailabilityRow[]> = {};
  for (const a of availabilities) {
    const list = availabilitiesByMember[a.membershipId] ?? [];
    list.push({ dayOfWeek: a.dayOfWeek, kind: a.kind as AvailabilityRow["kind"], startTime: a.startTime, endTime: a.endTime });
    availabilitiesByMember[a.membershipId] = list;
  }

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
  const absentMembershipIdsByDate: Record<string, string[]> = {};
  for (const [dateKey, set] of absentOn) absentMembershipIdsByDate[dateKey] = [...set];

  const shiftsByMemberDay = new Map<string, { id: string; startTime: string; endTime: string }[]>();
  for (const s of shifts) {
    const key = `${s.membershipId}|${toDateKey(s.date)}`;
    const list = shiftsByMemberDay.get(key) ?? [];
    list.push({ id: s.id, startTime: s.startTime, endTime: s.endTime });
    shiftsByMemberDay.set(key, list);
  }

  const shiftsCountByMember: Record<string, number> = {};
  for (const s of shifts) shiftsCountByMember[s.membershipId] = (shiftsCountByMember[s.membershipId] ?? 0) + 1;

  const planningShifts: PlanningShift[] = shifts.map((s) => {
    const dateKey = toDateKey(s.date);
    const isoDay = s.date.getDay() === 0 ? 7 : s.date.getDay();
    const otherShiftsSameDay = (shiftsByMemberDay.get(`${s.membershipId}|${dateKey}`) ?? []).filter((o) => o.id !== s.id);
    const memberAvailabilities = (availabilitiesByMember[s.membershipId] ?? []).filter((a) => a.dayOfWeek === isoDay);

    const evaluation = evaluateShift(
      { startTime: s.startTime, endTime: s.endTime },
      {
        otherShiftsSameDay,
        isAbsentThatDay: absentOn.get(dateKey)?.has(s.membershipId) ?? false,
        availabilities: memberAvailabilities,
      }
    );

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
      conflictLevel: evaluation.level,
      warnings: evaluation.warnings,
    };
  });

  const totalHoursByMember: Record<string, number> = {};
  for (const s of shifts) {
    totalHoursByMember[s.membershipId] =
      (totalHoursByMember[s.membershipId] ?? 0) + computeShiftDurationHours(s.startTime, s.endTime);
  }
  const totalTeamHours = Object.values(totalHoursByMember).reduce((a, b) => a + b, 0);

  // Le pire niveau de la semaine par personne — shifts en conflit/warning, ou limite
  // hebdomadaire atteinte (elle-même jamais portée par un shift précis, voir compute.ts).
  const memberWeekStatus: Record<string, ShiftConflictLevel> = {};
  for (const m of members) memberWeekStatus[m.membershipId] = "ok";
  for (const s of planningShifts) {
    if (CONFLICT_RANK[s.conflictLevel] > CONFLICT_RANK[memberWeekStatus[s.membershipId] ?? "ok"]) {
      memberWeekStatus[s.membershipId] = s.conflictLevel;
    }
  }
  for (const m of members) {
    const count = shiftsCountByMember[m.membershipId] ?? 0;
    if (count > 0 && m.maxShiftsPerWeek != null && count >= m.maxShiftsPerWeek && memberWeekStatus[m.membershipId] === "ok") {
      memberWeekStatus[m.membershipId] = "warning";
    }
  }

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
      });
    }
  }

  const alerts: PlanningAlert[] = [
    ...computeRhAlerts(planningShifts, members, dayLabels),
    ...computeWeeklyLimitAlerts(members, shiftsCountByMember),
    ...computePlanningAlerts(dayServices),
  ].sort((a, b) => {
    const rank: Record<PlanningAlert["severity"], number> = { urgent: 0, important: 1, watch: 2 };
    return rank[a.severity] - rank[b.severity];
  });

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
    shiftsCountByMember,
    totalTeamHours,
    memberWeekStatus,
    availabilitiesByMember,
    absentMembershipIdsByDate,
    canEdit: ctx.can("schedule.edit"),
  };
}
