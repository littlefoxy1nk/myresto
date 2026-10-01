import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addDays } from "date-fns";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { isoWeekday } from "@/lib/time";
import { computeWorkloadSummary } from "@/modules/workload/compute";
import { computeFrequentationSignal } from "@/modules/frequentation/compute";
import { getHistoricalCoversByWeekday } from "@/modules/frequentation/server/queries";
import {
  computeShiftDurationHours,
  computePlanningAlerts,
  computeRhAlerts,
  computeServiceObjective,
  computeServiceObjectiveAlerts,
  computeStaffingGapAlerts,
  computeWeekSummaryParts,
  computeWeeklyLimitAlerts,
  evaluateShift,
  isDayGenerallyUnavailable,
  isServiceUnavailable,
  occurrenceAvailabilities,
} from "@/modules/planning/compute";
import {
  SHIFT_POSITIONS,
  STAFFABLE_POSITIONS,
  TARGET_SHIFTS_RULE_TYPE,
  type AvailabilityRow,
  type CoverageRequestItem,
  type ObjectiveExclusion,
  type PlanningAlert,
  type PlanningDayService,
  type PlanningMember,
  type PlanningNoteItem,
  type PlanningServiceDefinition,
  type PlanningShift,
  type ServiceObjective,
  type ShiftConflictLevel,
  type ShiftPosition,
  type StaffingGapSlot,
  type StaffingRequirementCell,
  type WeekPlanningResult,
} from "@/modules/planning/types";

function dayLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("fr-BE", { weekday: "short", day: "numeric", month: "short" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fullDayLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function weekdayOnlyLabel(d: Date): string {
  return new Intl.DateTimeFormat("fr-BE", { weekday: "long" }).format(d);
}

const CONFLICT_RANK: Record<ShiftConflictLevel, number> = { ok: 0, warning: 1, conflict: 2 };
const OBJECTIVE_TO_CONFLICT_LEVEL: Record<ServiceObjective["status"], ShiftConflictLevel> = {
  atteint: "ok",
  incomplet: "warning",
  impossible: "conflict",
};

/// Assemble la semaine de planning : équipe, shifts (évalués un par un via evaluateShift
/// — disponibilités, congés, chevauchements) et objectifs de services (SchedulingRule)
/// confrontés aux créneaux réellement compatibles. Volontairement absent de ce fichier :
/// tout calcul reliant couverts et personnel — voir le principe en tête de
/// modules/planning/compute.ts. `weekStart` doit être un lundi normalisé à minuit.
export async function getWeekPlanning(establishmentId: string, weekStart: Date): Promise<WeekPlanningResult> {
  const ctx = await getCurrentContext();
  if (!ctx.can("schedule.view")) throw new ForbiddenError("schedule.view");
  const canEditSchedule = ctx.can("schedule.edit");

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rangeStart = startOfDay(weekStart);
  const rangeEnd = endOfDay(days[6]);

  const [memberships, shifts, services, timeOffs, reservations, availabilities, targetRules, historicalCoversByWeekday, planningNotes, requirementRows, coverageRequestRows] = await Promise.all([
    prisma.membership.findMany({
      where: { establishmentId, status: "active" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shift.findMany({
      where: {
        establishmentId,
        date: { gte: rangeStart, lte: rangeEnd },
        // Un shift généré ou créé en brouillon ("planned") reste invisible pour qui n'a
        // pas schedule.edit, tant qu'il n'a pas été publié (voir publishWeekSchedule) —
        // personne ne doit découvrir son horaire avant que le manager l'ait relu.
        status: canEditSchedule ? { not: "cancelled" } : { notIn: ["cancelled", "planned"] },
      },
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
    // Récurrentes (par jour de semaine), pas de filtre de date — un établissement a un
    // volume de disponibilités négligeable, pas besoin de les scoper à la semaine.
    prisma.availability.findMany({ where: { establishmentId } }),
    prisma.schedulingRule.findMany({ where: { establishmentId, type: TARGET_SHIFTS_RULE_TYPE } }),
    getHistoricalCoversByWeekday(establishmentId, weekStart),
    prisma.planningNote.findMany({
      where: { establishmentId, date: { gte: rangeStart, lte: rangeEnd } },
      include: { createdBy: { include: { user: true } } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }),
    prisma.staffingRequirement.findMany({ where: { establishmentId, requiredCount: { gt: 0 } } }),
    prisma.coverageRequest.findMany({
      where: { establishmentId, date: { gte: rangeStart, lte: rangeEnd } },
      include: { membership: { include: { user: true } }, service: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const notes: PlanningNoteItem[] = planningNotes.map((n) => ({
    id: n.id,
    date: toDateKey(n.date),
    dateLabel: fullDayLabel(n.date),
    time: n.time,
    message: n.message,
    createdByName: `${n.createdBy.user.firstName} ${n.createdBy.user.lastName}`,
  }));

  const VALID_SKILL_POSITIONS = new Set<string>(SHIFT_POSITIONS);
  const members: PlanningMember[] = memberships.map((m) => ({
    membershipId: m.id,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    jobTitle: m.jobTitle,
    weeklyHoursTarget: m.weeklyHoursTarget,
    maxShiftsPerWeek: m.maxShiftsPerWeek,
    employmentType: m.employmentType as PlanningMember["employmentType"],
    positions: (m.skills ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is ShiftPosition => VALID_SKILL_POSITIONS.has(s)),
  }));

  const requirements: StaffingRequirementCell[] = requirementRows.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    serviceId: r.serviceId,
    position: r.position as ShiftPosition,
    requiredCount: r.requiredCount,
  }));

  const coverageRequests: CoverageRequestItem[] = coverageRequestRows.map((r) => ({
    id: r.id,
    membershipId: r.membershipId,
    memberName: `${r.membership.user.firstName} ${r.membership.user.lastName}`,
    date: toDateKey(r.date),
    dateLabel: fullDayLabel(r.date),
    serviceId: r.serviceId,
    serviceName: r.service?.name ?? null,
    startTime: r.startTime,
    endTime: r.endTime,
    position: r.position as ShiftPosition,
    status: r.status as CoverageRequestItem["status"],
  }));

  const weekDays = days.map(toDateKey);
  const dayLabels: Record<string, string> = {};
  for (const d of days) dayLabels[toDateKey(d)] = dayLabel(d);

  const availabilitiesByMember: Record<string, AvailabilityRow[]> = {};
  for (const a of availabilities) {
    const list = availabilitiesByMember[a.membershipId] ?? [];
    list.push({
      dayOfWeek: a.dayOfWeek,
      kind: a.kind as AvailabilityRow["kind"],
      startTime: a.startTime,
      endTime: a.endTime,
      serviceId: a.serviceId,
      date: a.date ? toDateKey(a.date) : null,
    });
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
  // Pour savoir si une personne a déjà un shift sur un (date, service) donné, sans
  // recréer une seconde structure : on regarde directement les shifts filtrés plus bas.
  const shiftsByMemberDateService = new Set(shifts.map((s) => `${s.membershipId}|${toDateKey(s.date)}|${s.serviceId ?? ""}`));

  const shiftsCountByMember: Record<string, number> = {};
  for (const s of shifts) shiftsCountByMember[s.membershipId] = (shiftsCountByMember[s.membershipId] ?? 0) + 1;

  const planningShifts: PlanningShift[] = shifts.map((s) => {
    const dateKey = toDateKey(s.date);
    const isoDay = isoWeekday(s.date);
    const otherShiftsSameDay = (shiftsByMemberDay.get(`${s.membershipId}|${dateKey}`) ?? []).filter((o) => o.id !== s.id);
    const memberAvailabilities = occurrenceAvailabilities(availabilitiesByMember[s.membershipId] ?? [], isoDay, dateKey);

    const evaluation = evaluateShift(
      { startTime: s.startTime, endTime: s.endTime, serviceId: s.serviceId },
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

  const planningServices: PlanningServiceDefinition[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    daysOfWeek: s.daysOfWeek.split(",").map(Number),
  }));

  // Couverts/réservations par jour × service actif ce jour-là — délégué à
  // computeWorkloadSummary (module workload), jamais réécrit ici. Ne sert plus qu'à
  // détecter "aucun personnel planifié alors qu'il y a de la demande" : la fréquentation
  // (charge/tendance) est un module séparé, jamais croisée ici avec le personnel.
  const dayServices: PlanningDayService[] = [];
  for (const d of days) {
    const isoDay = isoWeekday(d);
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
      });
    }
  }

  // Fréquentation par jour (pas par service — l'historique de CA n'est suivi qu'au
  // jour près) : les couverts attendus ce jour-là, comparés au même jour de semaine
  // sur les semaines précédentes. Jamais croisé avec le personnel planifié.
  //
  // Limité à aujourd'hui et aux jours déjà passés de la semaine affichée : un jour futur
  // n'a pas encore accumulé ses réservations (les clients réservent au fil de l'eau), donc
  // le comparer déjà à l'habitude produirait presque toujours un faux "calme" — pas un
  // vrai signal de fréquentation, juste le fait qu'il est encore tôt pour ce jour-là.
  const todayEnd = endOfDay(new Date());
  const dayFrequentation = days
    .filter((d) => d <= todayEnd)
    .map((d) => {
      const dateKey = toDateKey(d);
      const expectedCovers = reservations.filter((r) => toDateKey(r.date) === dateKey).reduce((s, r) => s + r.partySize, 0);
      return {
        date: dateKey,
        dateLabel: fullDayLabel(d),
        signal: computeFrequentationSignal(expectedCovers, historicalCoversByWeekday[d.getDay()]),
      };
    });

  // Objectifs de services : pour chaque membre avec une règle définie, on cherche parmi
  // tous les (jour, service) de la semaine ceux qui ne sont ni déjà planifiés pour cette
  // personne, ni bloqués par un congé approuvé ou une indisponibilité générale déclarée.
  const objectivesByMember: Record<string, ServiceObjective> = {};
  for (const rule of targetRules) {
    if (!rule.membershipId) continue;
    let target: number;
    try {
      const params = JSON.parse(rule.params) as { count?: number };
      if (typeof params.count !== "number" || params.count <= 0) continue;
      target = params.count;
    } catch {
      continue;
    }

    const planned = shiftsCountByMember[rule.membershipId] ?? 0;
    const memberAvailabilities = availabilitiesByMember[rule.membershipId] ?? [];
    const compatibleSlots: { dateLabel: string }[] = [];
    const excludedDays: ObjectiveExclusion[] = [];

    for (const d of days) {
      const isoDay = isoWeekday(d);
      const dateKey = toDateKey(d);
      if (absentOn.get(dateKey)?.has(rule.membershipId)) {
        excludedDays.push({ dateLabel: weekdayOnlyLabel(d), reason: "conge" });
        continue;
      }

      const servicesToday = services.filter((s) => s.daysOfWeek.split(",").map(Number).includes(isoDay));
      const occurrenceAvailabilitiesForDay = occurrenceAvailabilities(memberAvailabilities, isoDay, dateKey);

      if (isDayGenerallyUnavailable(occurrenceAvailabilitiesForDay, isoDay, servicesToday.map((s) => s.id))) {
        excludedDays.push({ dateLabel: weekdayOnlyLabel(d), reason: "indisponible" });
        continue;
      }

      for (const service of servicesToday) {
        const key = `${rule.membershipId}|${dateKey}|${service.id}`;
        if (shiftsByMemberDateService.has(key)) continue; // déjà planifié, pas "restant"
        // Indisponible pour CE service précisément : le créneau n'est pas compatible,
        // sans pour autant exclure toute la journée si un autre service reste ouvert.
        if (isServiceUnavailable(occurrenceAvailabilitiesForDay, isoDay, service.id)) continue;
        compatibleSlots.push({ dateLabel: weekdayOnlyLabel(d) });
      }
    }

    objectivesByMember[rule.membershipId] = computeServiceObjective(target, planned, compatibleSlots, excludedDays);
  }

  // Le pire niveau de la semaine par personne — shifts en conflit/warning, limite
  // hebdomadaire, ou objectif de services (chacun jamais porté par un shift précis,
  // voir compute.ts).
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
    const objective = objectivesByMember[m.membershipId];
    if (objective) {
      const objectiveLevel = OBJECTIVE_TO_CONFLICT_LEVEL[objective.status];
      if (CONFLICT_RANK[objectiveLevel] > CONFLICT_RANK[memberWeekStatus[m.membershipId]]) {
        memberWeekStatus[m.membershipId] = objectiveLevel;
      }
    }
  }

  // Creux par rapport aux besoins en personnel déclarés (StaffingRequirement) — un
  // (jour, service, poste) par entrée, jamais déduit de la fréquentation (voir
  // computePlanningAlerts, qui répond à une question différente). Les shifts déjà en
  // brouillon ("planned") comptent déjà comme couverture : le manager qui les voit sait
  // qu'il reste à les publier, ce n'est pas un creux à combler une seconde fois.
  const staffingGapSlots: StaffingGapSlot[] = [];
  for (const d of days) {
    const isoDay = isoWeekday(d);
    const dateKey = toDateKey(d);
    const servicesToday = services.filter((s) => s.daysOfWeek.split(",").map(Number).includes(isoDay));
    for (const service of servicesToday) {
      for (const position of STAFFABLE_POSITIONS) {
        const required = requirements.find((r) => r.dayOfWeek === isoDay && r.serviceId === service.id && r.position === position)?.requiredCount ?? 0;
        if (required <= 0) continue;
        const assigned = planningShifts.filter((s) => s.date === dateKey && s.serviceId === service.id && s.position === position).length;
        staffingGapSlots.push({ date: dateKey, dateLabel: dayLabel(d), serviceId: service.id, serviceName: service.name, position, required, assigned });
      }
    }
  }

  const alerts: PlanningAlert[] = [
    ...computeRhAlerts(planningShifts, members, dayLabels),
    ...computeWeeklyLimitAlerts(members, shiftsCountByMember),
    ...computeServiceObjectiveAlerts(members, objectivesByMember),
    ...computePlanningAlerts(dayServices),
    ...computeStaffingGapAlerts(staffingGapSlots),
  ].sort((a, b) => {
    const rank: Record<PlanningAlert["severity"], number> = { urgent: 0, important: 1, watch: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  const weekSummary = computeWeekSummaryParts(alerts, members, objectivesByMember);

  return {
    weekStart: toDateKey(weekStart),
    weekDays,
    dayLabels,
    members,
    shifts: planningShifts,
    services: planningServices,
    dayServices,
    dayFrequentation,
    alerts,
    weekSummary,
    totalHoursByMember,
    shiftsCountByMember,
    totalTeamHours,
    objectivesByMember,
    memberWeekStatus,
    availabilitiesByMember,
    absentMembershipIdsByDate,
    canEdit: canEditSchedule,
    notes,
    requirements,
    staffingGaps: staffingGapSlots,
    coverageRequests,
  };
}
