import type {
  AvailabilityRow,
  DemandLevel,
  PlanningAlert,
  PlanningDayService,
  PlanningMember,
  PlanningShift,
  ShiftConflictLevel,
  ShiftWarning,
} from "./types";

/// Fonctions métier pures du Planning — aucun accès base de données. C'est le même
/// principe que src/modules/workload/compute.ts : un seul endroit qui sait calculer
/// des heures, des chevauchements, des disponibilités et un niveau de charge, jamais
/// réécrit ailleurs (côté serveur pour l'état persisté, côté client pour l'aperçu en
/// temps réel dans la modale — voir evaluateShift).

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

export type ShiftEvaluation = { level: ShiftConflictLevel; warnings: ShiftWarning[] };

/// Le point d'entrée unique qui décide si UN shift pose problème — utilisé côté
/// serveur pour calculer l'état persisté de chaque shift existant ET côté client pour
/// l'aperçu en temps réel dans la modale de création/édition, avant tout enregistrement.
/// Jamais bloquant : le rôle de cette fonction est d'informer, pas d'empêcher. Chaque
/// avertissement porte son propre niveau — un shift avec à la fois une absence (🔴) et
/// un souci de disponibilité (🟡) garde les deux, sans que le second n'hérite du premier.
/// La limite hebdomadaire de shifts n'est volontairement PAS ici : c'est un fait par
/// personne-semaine, pas par shift — elle serait sinon répétée sur chaque shift de la
/// semaine une fois le seuil atteint. Voir checkWeeklyLimit.
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
  if (availability.status !== "ok") {
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

// Le ratio couverts / capacité totale de la salle objective la densité de la demande
// sur l'espace physique pour un service complet (qui peut compter plusieurs tournées).
// Ce n'est PAS un calcul de personnel : aucune règle du type "1 serveur pour X couverts"
// n'intervient ici, volontairement — voir Mission 5 (Planning RH V1). Le jugement sur
// l'effectif nécessaire reste humain ; ceci ne fait qu'objectiver un des deux côtés
// de la comparaison que le manager doit faire lui-même.
const DEMAND_RATIO_MODERATE = 1;
const DEMAND_RATIO_HIGH = 2;

export function computeDemandLevel(covers: number, totalCapacity: number): DemandLevel {
  if (totalCapacity <= 0) return "indeterminee";
  const ratio = covers / totalCapacity;
  if (ratio <= DEMAND_RATIO_MODERATE) return "faible";
  if (ratio <= DEMAND_RATIO_HIGH) return "moderee";
  return "elevee";
}

// Seuils simples et transparents pour les alertes de cohérence — pas une prescription
// d'effectif "idéal", juste des situations qui méritent un regard humain. Appliqués au
// personnel de salle uniquement (floorStaffCount) : la cuisine, le bar et la direction
// ne varient pas avec le nombre de couverts de la même façon, les mélanger fausserait
// la comparaison.
const UNDERSTAFFED_MAX_FLOOR_STAFF = 1;
const OVERSTAFFED_MIN_FLOOR_STAFF = 4;

/// Alertes de cohérence "demande attendue ↔ personnel planifié", par service — jamais
/// de personnel individuel ici (voir computeRhAlerts pour les alertes centrées sur une
/// personne : absence, chevauchement, disponibilité, limite hebdomadaire).
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
      continue; // à 0 personne, l'alerte "peu de personnel" ci-dessous ferait doublon
    }

    if (ds.demandLevel === "elevee" && ds.floorStaffCount <= UNDERSTAFFED_MAX_FLOOR_STAFF) {
      alerts.push({
        id: `understaffed-${ds.date}-${ds.serviceId}`,
        severity: "important",
        title: "Forte demande, personnel de salle réduit",
        description: `${ds.serviceName} · ${ds.dateLabel} — ${ds.covers} couverts prévus pour ${ds.floorStaffCount} personne${ds.floorStaffCount > 1 ? "s" : ""} en salle.`,
      });
    }

    if (ds.demandLevel === "faible" && ds.floorStaffCount >= OVERSTAFFED_MIN_FLOOR_STAFF) {
      alerts.push({
        id: `overstaffed-${ds.date}-${ds.serviceId}`,
        severity: "watch",
        title: "Personnel de salle important, faible demande",
        description: `${ds.serviceName} · ${ds.dateLabel} — ${ds.floorStaffCount} personnes en salle pour ${ds.covers} couvert${ds.covers > 1 ? "s" : ""} prévu${ds.covers > 1 ? "s" : ""}.`,
      });
    }
  }

  return sortAlerts(alerts);
}

function sortAlerts(alerts: PlanningAlert[]): PlanningAlert[] {
  const severityRank: Record<PlanningAlert["severity"], number> = { urgent: 0, important: 1, watch: 2 };
  return [...alerts].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
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
        severity: warning.level === "conflict" ? "urgent" : "watch",
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
        severity: "watch",
        title: `${m.firstName} ${m.lastName} — ${message}`,
      });
    }
  }
  return sortAlerts(alerts);
}
