import type {
  AvailabilityRow,
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
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function shiftsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
}

export type AvailabilityCheck =
  | { status: "ok" }
  | { status: "unavailable"; reason: string }
  | { status: "outside_preferred"; reason: string };

/// Compare un créneau de shift aux disponibilités déclarées (récurrentes, par jour de
/// semaine) d'une personne. "unavailable" est prioritaire — une indisponibilité
/// explicite prime sur une simple préférence. Si la personne n'a rien déclaré du tout
/// pour ce jour, on ne peut rien affirmer honnêtement : "ok" par défaut, jamais un
/// avertissement fondé sur une absence de donnée.
export function checkAvailability(shift: { startTime: string; endTime: string }, availabilities: AvailabilityRow[]): AvailabilityCheck {
  const shiftStart = toMinutes(shift.startTime);
  const shiftEnd = toMinutes(shift.endTime);

  for (const a of availabilities.filter((a) => a.kind === "unavailable")) {
    const uStart = a.startTime ? toMinutes(a.startTime) : 0;
    const uEnd = a.endTime ? toMinutes(a.endTime) : 24 * 60;
    if (shiftStart < uEnd && uStart < shiftEnd) {
      return {
        status: "unavailable",
        reason: a.startTime && a.endTime ? `Indisponible déclaré ${a.startTime}–${a.endTime}` : "Indisponible déclaré toute la journée",
      };
    }
  }

  const preferred = availabilities.filter((a) => a.kind === "preferred" && a.startTime && a.endTime);
  if (preferred.length > 0) {
    const withinAny = preferred.some((p) => shiftStart >= toMinutes(p.startTime!) && shiftEnd <= toMinutes(p.endTime!));
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

/// Un jour de semaine est "indisponible en général" quand une indisponibilité
/// déclarée couvre la journée entière (pas seulement une plage horaire) — c'est cette
/// notion, pas une plage précise, qui détermine si un créneau reste compatible pour
/// atteindre un objectif de services (voir computeServiceObjective).
export function isDayGenerallyUnavailable(availabilities: AvailabilityRow[], dayOfWeek: number): boolean {
  return availabilities.some((a) => a.dayOfWeek === dayOfWeek && a.kind === "unavailable" && a.startTime == null);
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
  shift: { startTime: string; endTime: string },
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
  compatibleSlots: { dateLabel: string }[]
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
