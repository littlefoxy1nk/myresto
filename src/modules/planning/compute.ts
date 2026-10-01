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
  ShiftPosition,
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

// =========================================================================
// GÉNÉRATEUR D'HORAIRE — propose des affectations à partir des besoins en personnel
// déclarés (StaffingRequirement), des disponibilités et des objectifs de services.
// Aucune IA, aucun scoring opaque : un algorithme déterministe en deux passes, que l'on
// peut expliquer entièrement. Ne décide jamais seul(e) — le résultat atterrit en shifts
// "planned" (brouillon, voir planning/server/actions.ts), à relire avant publication.
// =========================================================================

export type GeneratorMember = {
  membershipId: string;
  employmentType: "fixe" | "flexijob";
  positions: ShiftPosition[];
  /// Objectif de services hebdomadaire (SchedulingRule) — 1 par défaut pour un poste
  /// fixe sans objectif défini, pour que le ratio assignedCount/target reste calculable
  /// sans jamais diviser par zéro. Non utilisé pour un flexijob (voir plus bas : traité
  /// comme "extra", prioritaire sur les créneaux où il est disponible, jamais comparé à
  /// un objectif — cohérent avec le fait qu'il gère déjà librement son propre horaire).
  weeklyTarget: number;
};

export type GeneratorSlot = {
  date: string; // "yyyy-MM-dd"
  dayOfWeek: number;
  serviceId: string;
  startTime: string;
  endTime: string;
  position: ShiftPosition;
  required: number;
  /// Nombre de shifts déjà placés à la main sur exactement ce (date, service, poste) —
  /// jamais recréés ni comptés en double, voir le principe "respecte l'existant".
  alreadyFilled: number;
};

export type GeneratedAssignment = {
  date: string;
  serviceId: string;
  position: ShiftPosition;
  startTime: string;
  endTime: string;
  membershipId: string;
};

/// Propose un horaire à partir des créneaux à pourvoir, en deux passes :
///
/// 1) Remplissage : les créneaux sont traités du plus tendu au plus large (le moins
///    d'options disponibles par rapport au besoin restant), pour que le personnel
///    polyvalent (éligible à plusieurs postes) soit utilisé là où il est vraiment
///    nécessaire plutôt que "consommé" par le premier créneau traité. À l'intérieur d'un
///    créneau : les flexijobs disponibles en premier (ils gèrent déjà librement leur
///    horaire, autant les utiliser pour soulager les postes fixes), puis les postes
///    fixes les plus loin de leur objectif hebdomadaire, les fixes déjà à l'objectif en
///    tout dernier recours.
///
/// 2) Rééquilibrage : le remplissage avance créneau par créneau sans revenir en
///    arrière, ce qui peut laisser quelqu'un sous son objectif en fin de semaine alors
///    qu'un·e collègue dépasse le sien sur un créneau où les deux étaient éligibles.
///    Cette passe cherche ce genre d'échanges (jamais sur un flexijob, jamais sur un
///    shift déjà présent avant la génération) et les applique tant qu'il en reste —
///    chaque créneau n'est cependant jamais échangé plus d'une fois, pour ne jamais
///    faire d'aller-retour sans fin entre deux personnes chacune sous leur propre
///    objectif.
///
/// `isEligible` encapsule tout ce qui dépend des données déjà chargées par l'appelant
/// (disponibilités de l'occurrence, congé approuvé ce jour-là) — cette fonction reste
/// pure et ignore tout du stockage. `existingShiftsByMember` sert à ne jamais
/// double-réserver quelqu'un sur un autre service qui chevauche le même jour, qu'il ait
/// été placé à la main ou par un générateur précédent.
export function generateScheduleAssignments(params: {
  members: GeneratorMember[];
  slots: GeneratorSlot[];
  isEligible: (membershipId: string, slot: GeneratorSlot) => boolean;
  existingShiftsByMember: Record<string, { date: string; startTime: string; endTime: string }[]>;
  existingCountByMember: Record<string, number>;
}): GeneratedAssignment[] {
  const { members, slots, isEligible, existingShiftsByMember, existingCountByMember } = params;

  const targetByMember = new Map(members.map((m) => [m.membershipId, m.weeklyTarget || 1]));
  const assignedCount: Record<string, number> = {};
  for (const m of members) assignedCount[m.membershipId] = existingCountByMember[m.membershipId] ?? 0;

  const busyByMember = new Map<string, { date: string; startTime: string; endTime: string }[]>();
  for (const m of members) busyByMember.set(m.membershipId, [...(existingShiftsByMember[m.membershipId] ?? [])]);

  const isBusy = (membershipId: string, slot: GeneratorSlot) =>
    (busyByMember.get(membershipId) ?? []).some((b) => b.date === slot.date && shiftsOverlap(b, slot));

  const eligiblePool = (slot: GeneratorSlot) =>
    members.filter((m) => m.positions.includes(slot.position) && isEligible(m.membershipId, slot) && !isBusy(m.membershipId, slot));

  const pending = slots
    .map((slot) => ({ slot, remaining: Math.max(slot.required - slot.alreadyFilled, 0) }))
    .filter((s) => s.remaining > 0)
    .sort((a, b) => {
      const slackA = eligiblePool(a.slot).length - a.remaining;
      const slackB = eligiblePool(b.slot).length - b.remaining;
      return slackA - slackB;
    });

  const assignments: GeneratedAssignment[] = [];

  function assign(membershipId: string, slot: GeneratorSlot) {
    assignments.push({ date: slot.date, serviceId: slot.serviceId, position: slot.position, startTime: slot.startTime, endTime: slot.endTime, membershipId });
    assignedCount[membershipId] += 1;
    busyByMember.get(membershipId)!.push({ date: slot.date, startTime: slot.startTime, endTime: slot.endTime });
  }

  // --- Passe 1 : remplissage, créneaux les plus tendus en premier ---
  for (const { slot, remaining } of pending) {
    const pool = eligiblePool(slot);
    const extraPool = pool.filter((m) => m.employmentType === "flexijob");
    const fixedPool = pool
      .filter((m) => m.employmentType === "fixe")
      .sort((a, b) => assignedCount[a.membershipId] / targetByMember.get(a.membershipId)! - assignedCount[b.membershipId] / targetByMember.get(b.membershipId)!);

    const picked: string[] = [];
    for (const m of extraPool) {
      if (picked.length >= remaining) break;
      picked.push(m.membershipId);
    }
    for (const m of fixedPool) {
      if (picked.length >= remaining) break;
      if (assignedCount[m.membershipId] < targetByMember.get(m.membershipId)!) picked.push(m.membershipId);
    }
    for (const m of fixedPool) {
      if (picked.length >= remaining) break;
      if (!picked.includes(m.membershipId)) picked.push(m.membershipId);
    }

    for (const id of picked) assign(id, slot);
  }

  // --- Passe 2 : rééquilibrage par échanges (jamais sur un flexijob ni sur l'existant) ---
  // Un créneau déjà échangé une fois n'est plus jamais rejoué : sans ça, deux personnes
  // chacune sous leur propre objectif peuvent se céder le même créneau indéfiniment (A
  // le prend à B parce que B est "moins sous objectif" que A à cet instant, puis B le
  // reprend à A pour la même raison inversée) — un cycle sans fin, jamais une
  // amélioration réelle. Figer chaque créneau après un seul échange garantit que la
  // passe se termine d'elle-même, bien avant la limite de sécurité à 300 tours.
  const swappedSlotKeys = new Set<string>();
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 300) {
    improved = false;
    iterations += 1;

    const underTarget = members
      .filter((m) => m.employmentType === "fixe" && assignedCount[m.membershipId] < targetByMember.get(m.membershipId)!)
      .sort((a, b) => assignedCount[a.membershipId] / targetByMember.get(a.membershipId)! - assignedCount[b.membershipId] / targetByMember.get(b.membershipId)!);

    search: for (const under of underTarget) {
      for (const slot of slots) {
        const slotKey = `${slot.date}|${slot.serviceId}|${slot.position}`;
        if (swappedSlotKeys.has(slotKey)) continue;
        if (!under.positions.includes(slot.position)) continue;
        if (!isEligible(under.membershipId, slot)) continue;
        if (isBusy(under.membershipId, slot)) continue;

        const assignmentIndex = assignments.findIndex(
          (a) => a.date === slot.date && a.serviceId === slot.serviceId && a.position === slot.position
        );
        if (assignmentIndex === -1) continue; // pas une affectation créée par cette génération
        const current = assignments[assignmentIndex];
        if (current.membershipId === under.membershipId) continue;

        const swapOut = members.find((m) => m.membershipId === current.membershipId);
        if (!swapOut || swapOut.employmentType !== "fixe") continue;

        const swapOutRatio = assignedCount[swapOut.membershipId] / targetByMember.get(swapOut.membershipId)!;
        const underRatio = assignedCount[under.membershipId] / targetByMember.get(under.membershipId)!;
        if (swapOutRatio <= underRatio) continue;

        assignments[assignmentIndex] = { ...current, membershipId: under.membershipId };
        assignedCount[swapOut.membershipId] -= 1;
        assignedCount[under.membershipId] += 1;
        swappedSlotKeys.add(slotKey);

        const swapOutBusy = busyByMember.get(swapOut.membershipId)!;
        const busyIdx = swapOutBusy.findIndex((b) => b.date === slot.date && b.startTime === slot.startTime && b.endTime === slot.endTime);
        if (busyIdx !== -1) swapOutBusy.splice(busyIdx, 1);
        busyByMember.get(under.membershipId)!.push({ date: slot.date, startTime: slot.startTime, endTime: slot.endTime });

        improved = true;
        break search;
      }
    }
  }

  return assignments;
}
