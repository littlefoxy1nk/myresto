import { timeToMinutes } from "@/lib/time";
import type {
  AvailabilityRow,
  ObjectiveExclusion,
  PlanningAlert,
  PlanningDayService,
  PlanningMember,
  PlanningShift,
  ServiceObjective,
  ServiceObjectiveStatus,
  ShiftConflictLevel,
  ShiftWarning,
} from "./types";

/// Fonctions métier pures du Planning — aucun accès base de données. C'est le même
/// principe que src/modules/workload/compute.ts : un seul endroit qui sait calculer
/// des heures, des chevauchements, des disponibilités et des objectifs de services,
/// jamais réécrit ailleurs (côté serveur pour l'état persisté, côté client pour
/// l'aperçu en temps réel dans la modale — voir evaluateShift).
///
/// Principe absolu de ce fichier : aucune fonction ici ne doit jamais déduire un
/// nombre de personnes nécessaires à partir d'un nombre de couverts. Le moteur ne
/// connaît que les contraintes réelles des travailleurs (disponibilités, congés,
/// limites, objectifs de services) — la fréquentation est un module séparé
/// (frequentation), volontairement découplé de tout calcul de personnel.

export function computeShiftDurationHours(startTime: string, endTime: string): number {
  return (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
}

export function shiftsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
}

export type AvailabilityCheck =
  | { status: "ok" }
  | { status: "unavailable"; reason: string }
  | { status: "outside_preferred"; reason: string };

/// Compare un créneau de shift aux disponibilités déclarées (déjà réduites par
/// l'appelant à celles applicables à cette occurrence précise — récurrentes de ce jour
/// de semaine, ou ponctuelles de cette date exacte, voir le commentaire sur
/// Availability.date dans schema.prisma) d'une personne. "unavailable" est
/// prioritaire — une indisponibilité explicite prime sur l'horaire habituel. Si la
/// personne n'a rien déclaré du tout, on ne peut rien affirmer honnêtement : "ok" par
/// défaut, jamais un avertissement fondé sur une absence de donnée. Une ligne liée à
/// un service précis (serviceId) ne s'applique qu'aux shifts de CE service ; les
/// lignes sans service restent le mode "journée entière ou plage horaire libre".
export function checkAvailability(
  shift: { startTime: string; endTime: string; serviceId?: string | null },
  availabilities: AvailabilityRow[]
): AvailabilityCheck {
  const shiftStart = timeToMinutes(shift.startTime);
  const shiftEnd = timeToMinutes(shift.endTime);
  const shiftServiceId = shift.serviceId ?? null;

  for (const a of availabilities.filter((a) => a.kind === "unavailable")) {
    if (a.serviceId != null) {
      if (a.serviceId !== shiftServiceId) continue;
      return { status: "unavailable", reason: "Indisponible déclaré pour ce service" };
    }
    const uStart = a.startTime ? timeToMinutes(a.startTime) : 0;
    const uEnd = a.endTime ? timeToMinutes(a.endTime) : 24 * 60;
    if (shiftStart < uEnd && uStart < shiftEnd) {
      return {
        status: "unavailable",
        reason: a.startTime && a.endTime ? `Indisponible déclaré ${a.startTime}–${a.endTime}` : "Indisponible déclaré toute la journée",
      };
    }
  }

  // Horaire habituel par service (nouveau, positif) : dès qu'au moins un service est
  // déclaré comme "travaillé habituellement" ce jour-là, un shift sur un AUTRE service
  // ce même jour sort de ce modèle — un signal doux (warning), jamais un conflit dur,
  // exactement comme l'ancienne plage horaire libre ci-dessous.
  const usualPattern = availabilities.filter((a) => a.kind === "preferred" && a.serviceId != null);
  if (usualPattern.length > 0) {
    const matches = usualPattern.some((p) => p.serviceId === shiftServiceId);
    if (!matches) {
      return { status: "outside_preferred", reason: "Ne travaille pas habituellement ce service ce jour-là" };
    }
    return { status: "ok" };
  }

  const preferred = availabilities.filter((a) => a.kind === "preferred" && a.serviceId == null && a.startTime && a.endTime);
  if (preferred.length > 0) {
    const withinAny = preferred.some((p) => shiftStart >= timeToMinutes(p.startTime!) && shiftEnd <= timeToMinutes(p.endTime!));
    if (!withinAny) {
      const closest = preferred[0];
      return {
        status: "outside_preferred",
        reason: `Disponibilité déclarée ${closest.startTime}–${closest.endTime}, ce shift est en dehors`,
      };
    }
  }

  return { status: "ok" };
}

/// Réduit une liste de disponibilités à celles qui s'appliquent réellement à UNE
/// occurrence précise (ce jour de semaine récurrent, OU cette date exacte pour une
/// ligne ponctuelle) — à appeler avant checkAvailability/isDayGenerallyUnavailable/
/// isServiceUnavailable, qui ne savent lire que dayOfWeek/kind/serviceId sans avoir à
/// se soucier de la distinction récurrent/ponctuel.
export function occurrenceAvailabilities(availabilities: AvailabilityRow[], dayOfWeek: number, dateKey: string): AvailabilityRow[] {
  return availabilities.filter((a) => (a.date ? a.date === dateKey : a.dayOfWeek === dayOfWeek));
}

/// Un jour de semaine est "indisponible en général" soit à l'ancienne (une ligne
/// "journée entière" sans service ni horaire), soit quand TOUS les services de
/// l'établissement actifs ce jour-là (serviceIdsToday, déjà filtrés par appelant) sont
/// individuellement marqués indisponibles — s'il n'en reste qu'un de coché, la journée
/// garde un créneau compatible, elle n'est pas "générale". C'est cette notion qui
/// détermine si un créneau reste compatible pour un objectif de services (voir
/// computeServiceObjective) — pas une plage précise.
export function isDayGenerallyUnavailable(
  availabilities: AvailabilityRow[],
  dayOfWeek: number,
  serviceIdsToday: string[] = []
): boolean {
  const dayUnavailable = availabilities.filter((a) => a.dayOfWeek === dayOfWeek && a.kind === "unavailable");
  if (dayUnavailable.some((a) => (a.serviceId ?? null) == null && a.startTime == null)) return true;
  if (serviceIdsToday.length === 0) return false;
  const unavailableServiceIds = new Set(dayUnavailable.filter((a) => a.serviceId != null).map((a) => a.serviceId));
  return serviceIdsToday.every((id) => unavailableServiceIds.has(id));
}

/// Un service précis (pas la journée entière) est marqué indisponible pour ce jour de
/// semaine — utilisé pour exclure UN créneau compatible sans exclure toute la journée
/// (voir isDayGenerallyUnavailable pour le cas "tous les services").
export function isServiceUnavailable(availabilities: AvailabilityRow[], dayOfWeek: number, serviceId: string): boolean {
  return availabilities.some((a) => a.dayOfWeek === dayOfWeek && a.kind === "unavailable" && a.serviceId === serviceId);
}

export type ShiftEvaluation = { level: ShiftConflictLevel; warnings: ShiftWarning[] };

/// Le point d'entrée unique qui décide si UN shift pose problème — utilisé côté
/// serveur pour calculer l'état persisté de chaque shift existant ET côté client pour
/// l'aperçu en temps réel dans la modale de création/édition, avant tout enregistrement.
/// Jamais bloquant : le rôle de cette fonction est d'informer, pas d'empêcher. Chaque
/// avertissement porte son propre niveau — un shift avec à la fois une absence (🔴) et
/// un souci de disponibilité (🟠) garde les deux, sans que le second n'hérite du premier.
/// Une indisponibilité explicitement déclarée et violée (🔴) est un fait vérifié, au même
/// titre qu'un chevauchement — une simple préférence non respectée (🟠) reste un signal
/// plus doux. La limite hebdomadaire de shifts n'est volontairement PAS ici : c'est un
/// fait par personne-semaine, pas par shift — elle serait sinon répétée sur chaque shift
/// de la semaine une fois le seuil atteint. Voir checkWeeklyLimit.
export function evaluateShift(
  shift: { startTime: string; endTime: string; serviceId?: string | null },
  context: {
    /// Les autres shifts de la même personne le même jour (le shift évalué exclu).
    otherShiftsSameDay: { startTime: string; endTime: string }[];
    isAbsentThatDay: boolean;
    availabilities: AvailabilityRow[];
  }
): ShiftEvaluation {
  const warnings: ShiftWarning[] = [];

  if (context.isAbsentThatDay) {
    warnings.push({ level: "conflict", message: "Congé approuvé ce jour-là" });
  }

  if (context.otherShiftsSameDay.some((o) => shiftsOverlap(shift, o))) {
    warnings.push({ level: "conflict", message: "Chevauche un autre shift ce jour-là" });
  }

  const availability = checkAvailability(shift, context.availabilities);
  if (availability.status === "unavailable") {
    warnings.push({ level: "conflict", message: availability.reason });
  } else if (availability.status === "outside_preferred") {
    warnings.push({ level: "warning", message: availability.reason });
  }

  const level: ShiftConflictLevel = warnings.some((w) => w.level === "conflict")
    ? "conflict"
    : warnings.length > 0
      ? "warning"
      : "ok";

  return { level, warnings };
}

/// Fait par personne-semaine, pas par shift — voir evaluateShift. `otherShiftsThisWeekCount`
/// exclut le shift en cours d'édition (ou vaut le total si on regarde une personne dans
/// l'absolu, sans shift précis en cours de saisie).
export function checkWeeklyLimit(otherShiftsThisWeekCount: number, maxShiftsPerWeek: number | null): string | null {
  if (maxShiftsPerWeek == null) return null;
  const total = otherShiftsThisWeekCount + 1;
  if (total < maxShiftsPerWeek) return null;
  return `Limite hebdomadaire atteinte (${total}/${maxShiftsPerWeek} shifts)`;
}

/// Objectif de services d'une personne pour la semaine (SchedulingRule,
/// type "target_shifts_per_week") confronté aux créneaux réellement compatibles avec
/// ses contraintes connues. "impossible" est un fait mathématique (pas assez de
/// créneaux compatibles pour atteindre la cible), jamais un jugement sur la personne.
export function computeServiceObjective(
  target: number,
  planned: number,
  compatibleSlots: { dateLabel: string }[],
  excludedDays: ObjectiveExclusion[] = []
): ServiceObjective {
  const remaining = Math.max(target - planned, 0);
  const compatibleSlotsRemaining = compatibleSlots.length;

  let status: ServiceObjectiveStatus;
  if (planned >= target) status = "atteint";
  else if (compatibleSlotsRemaining >= remaining) status = "incomplet";
  else status = "impossible";

  return {
    target,
    planned,
    remaining,
    compatibleSlotsRemaining,
    compatibleDayLabels: [...new Set(compatibleSlots.map((s) => s.dateLabel))],
    excludedDays,
    status,
  };
}

function sortAlerts(alerts: PlanningAlert[]): PlanningAlert[] {
  const severityRank: Record<PlanningAlert["severity"], number> = { urgent: 0, important: 1, watch: 2 };
  return [...alerts].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

/// Un seul fait factuel par service : aucun personnel planifié alors qu'il y a de la
/// demande. Jamais de comparaison "assez/pas assez" de personnel vis-à-vis des
/// couverts — voir le principe absolu en tête de fichier.
export function computePlanningAlerts(dayServices: PlanningDayService[]): PlanningAlert[] {
  const alerts: PlanningAlert[] = [];

  for (const ds of dayServices) {
    const hasDemand = ds.covers > 0 || ds.reservationsCount > 0;
    if (ds.staffCount === 0 && hasDemand) {
      alerts.push({
        id: `no-staff-${ds.date}-${ds.serviceId}`,
        severity: "urgent",
        title: "Aucun personnel planifié",
        description: `${ds.serviceName} · ${ds.dateLabel} — ${ds.covers} couvert${ds.covers > 1 ? "s" : ""} prévu${ds.covers > 1 ? "s" : ""}.`,
      });
    }
  }

  return sortAlerts(alerts);
}

/// Alertes centrées sur une personne — dérivées du même conflictLevel/warnings que les
/// badges affichés sur chaque shift (evaluateShift), jamais recalculées séparément.
/// C'est la fonction qui répond à "regarder une semaine et comprendre immédiatement".
export function computeRhAlerts(shifts: PlanningShift[], members: PlanningMember[], dayLabels: Record<string, string>): PlanningAlert[] {
  const nameByMembership = new Map(members.map((m) => [m.membershipId, `${m.firstName} ${m.lastName}`]));
  const alerts: PlanningAlert[] = [];

  for (const s of shifts) {
    if (s.conflictLevel === "ok") continue;
    const name = nameByMembership.get(s.membershipId) ?? "?";
    const label = dayLabels[s.date] ?? s.date;
    for (const warning of s.warnings) {
      alerts.push({
        id: `shift-${s.id}-${warning.message}`,
        severity: warning.level === "conflict" ? "urgent" : "important",
        title: `${name} — ${warning.message}`,
        description: `${label} · ${s.startTime}–${s.endTime}`,
      });
    }
  }

  return sortAlerts(alerts);
}

/// Fait par personne-semaine (voir checkWeeklyLimit) — une seule entrée par personne,
/// jamais répétée sur chaque shift.
export function computeWeeklyLimitAlerts(members: PlanningMember[], shiftsCountByMember: Record<string, number>): PlanningAlert[] {
  const alerts: PlanningAlert[] = [];
  for (const m of members) {
    const count = shiftsCountByMember[m.membershipId] ?? 0;
    const message = checkWeeklyLimit(Math.max(count - 1, 0), m.maxShiftsPerWeek);
    if (message && count > 0) {
      alerts.push({
        id: `weekly-limit-${m.membershipId}`,
        severity: "important",
        title: `${m.firstName} ${m.lastName} — ${message}`,
      });
    }
  }
  return sortAlerts(alerts);
}

/// Une entrée par personne dont l'objectif est "incomplet" ou "impossible" —
/// "atteint" est un état calme, il n'a pas besoin de remonter dans la liste
/// d'alertes (il reste visible en 🟢 directement sur la grille).
export function computeServiceObjectiveAlerts(
  members: PlanningMember[],
  objectivesByMember: Record<string, ServiceObjective>
): PlanningAlert[] {
  const alerts: PlanningAlert[] = [];
  for (const m of members) {
    const objective = objectivesByMember[m.membershipId];
    if (!objective || objective.status === "atteint") continue;

    if (objective.status === "impossible") {
      alerts.push({
        id: `objective-impossible-${m.membershipId}`,
        severity: "urgent",
        title: `${m.firstName} ${m.lastName} ne peut pas atteindre son objectif de services`,
        description: `${objective.compatibleSlotsRemaining} créneau${objective.compatibleSlotsRemaining > 1 ? "x" : ""} compatible${objective.compatibleSlotsRemaining > 1 ? "s" : ""} pour ${objective.remaining} restant${objective.remaining > 1 ? "s" : ""} sur un objectif de ${objective.target}.`,
      });
    } else {
      alerts.push({
        id: `objective-incomplete-${m.membershipId}`,
        severity: "important",
        title: `${m.firstName} ${m.lastName} — ${objective.planned}/${objective.target} services planifiés`,
        description: `${objective.remaining} service${objective.remaining > 1 ? "s" : ""} restent à planifier.`,
      });
    }
  }
  return sortAlerts(alerts);
}

/// Résumé factuel affiché en haut du Planning — un compte de ce que le bandeau
/// d'alertes détaille déjà plus bas, jamais une recommandation ("il faut X serveurs")
/// ni un jugement ("planning optimal"). Repose sur les préfixes d'id posés par
/// computeRhAlerts/computeWeeklyLimitAlerts/computePlanningAlerts ci-dessus — les
/// objectifs sont lus directement dans objectivesByMember plutôt que reparsés depuis
/// les alertes, pour rester exacts si leur libellé change un jour.
const MAX_NAMED_OBJECTIVES_IN_SUMMARY = 2;

export function computeWeekSummaryParts(
  alerts: PlanningAlert[],
  members: PlanningMember[],
  objectivesByMember: Record<string, ServiceObjective>
): string[] {
  const parts: string[] = [];

  const conflictCount = alerts.filter((a) => a.id.startsWith("shift-") && a.severity === "urgent").length;
  if (conflictCount > 0) parts.push(`${conflictCount} conflit${conflictCount > 1 ? "s" : ""} à vérifier`);

  const availabilityWarnings = alerts.filter((a) => a.id.startsWith("shift-") && a.severity === "important").length;
  if (availabilityWarnings > 0) {
    parts.push(
      `${availabilityWarnings} disponibilité${availabilityWarnings > 1 ? "s" : ""} non respectée${availabilityWarnings > 1 ? "s" : ""}`
    );
  }

  const weeklyLimitCount = alerts.filter((a) => a.id.startsWith("weekly-limit-")).length;
  if (weeklyLimitCount > 0) {
    parts.push(
      `${weeklyLimitCount} limite${weeklyLimitCount > 1 ? "s" : ""} hebdomadaire${weeklyLimitCount > 1 ? "s" : ""} atteinte${weeklyLimitCount > 1 ? "s" : ""}`
    );
  }

  const noStaffCount = alerts.filter((a) => a.id.startsWith("no-staff-")).length;
  if (noStaffCount > 0) {
    parts.push(`${noStaffCount} service${noStaffCount > 1 ? "s" : ""} sans personnel planifié`);
  }

  const incompleteObjectives = members
    .map((m) => ({ member: m, objective: objectivesByMember[m.membershipId] }))
    .filter((x): x is { member: PlanningMember; objective: ServiceObjective } => !!x.objective && x.objective.status !== "atteint");

  for (const { member, objective } of incompleteObjectives.slice(0, MAX_NAMED_OBJECTIVES_IN_SUMMARY)) {
    parts.push(`${member.firstName} : ${objective.planned}/${objective.target} services`);
  }
  const remainingCount = incompleteObjectives.length - MAX_NAMED_OBJECTIVES_IN_SUMMARY;
  if (remainingCount > 0) {
    parts.push(`${remainingCount} autre${remainingCount > 1 ? "s" : ""} objectif${remainingCount > 1 ? "s" : ""} incomplet${remainingCount > 1 ? "s" : ""}`);
  }

  return parts;
}
