// Types du Planning RH. Volontairement indépendants de Prisma pour que compute.ts
// reste une fonction pure, testable sans base de données (même convention que le
// module workload).

import type { FrequentationSignal } from "@/modules/frequentation/types";

/// Type de SchedulingRule qui porte l'objectif de services hebdomadaire d'une personne
/// — partagé par planning/server/{actions,queries}.ts et myspace/server/queries.ts,
/// jamais redéfini localement.
export const TARGET_SHIFTS_RULE_TYPE = "target_shifts_per_week";

export const SHIFT_POSITIONS = ["salle", "cuisine", "bar", "plonge", "direction"] as const;
export type ShiftPosition = (typeof SHIFT_POSITIONS)[number];

export const SHIFT_POSITION_LABELS: Record<ShiftPosition, string> = {
  salle: "Salle",
  cuisine: "Cuisine",
  bar: "Bar",
  plonge: "Plonge",
  direction: "Direction",
};

/// Regroupement en 2 zones pour l'affichage double du planning (voir
/// PlanningZoneTabs) — "direction" n'appartient à aucune des deux, volontairement :
/// ce n'est pas un poste de service, il reste visible uniquement dans la vue "Tous".
/// Postes qu'on dimensionne et qu'on peut vraiment assigner à quelqu'un via ses
/// compétences — jamais "direction", qui n'est pas une compétence qu'on coche (voir
/// new-employee-form.tsx) ni un poste de service qu'on planifie en masse.
export const STAFFABLE_POSITIONS = SHIFT_POSITIONS.filter((p): p is Exclude<ShiftPosition, "direction"> => p !== "direction");

export const SHIFT_ZONES = ["salle", "cuisine"] as const;
export type ShiftZone = (typeof SHIFT_ZONES)[number];
export const SHIFT_ZONE_LABELS: Record<ShiftZone, string> = { salle: "Salle", cuisine: "Cuisine" };
export const POSITIONS_BY_ZONE: Record<ShiftZone, ShiftPosition[]> = {
  salle: ["salle", "bar"],
  cuisine: ["cuisine", "plonge"],
};

/// Niveau de lecture "un coup d'œil" demandé en Mission 6 : ok (🟢), warning (🟡, à
/// vérifier — jamais bloquant), conflict (🔴, contradiction réelle dans les données :
/// chevauchement ou personne planifiée pendant une absence approuvée).
export type ShiftConflictLevel = "ok" | "warning" | "conflict";

export type AvailabilityKind = "preferred" | "unavailable";

export type AvailabilityRow = {
  dayOfWeek: number; // 1..7, 1=lundi
  kind: AvailabilityKind;
  startTime: string | null; // null + kind=unavailable = indisponible toute la journée
  endTime: string | null;
  /// Non défini (ou null) = ancien mode "journée entière ou plage horaire libre",
  /// toujours pris en charge pour les établissements qui préfèrent ça. Défini = la
  /// ligne ne s'applique qu'à ce service précis (startTime/endTime alors ignorés — le
  /// service porte déjà son propre horaire). Voir isServiceUnavailable/checkAvailability.
  serviceId?: string | null;
  /// "yyyy-MM-dd" — non défini (ou null) = récurrent, s'applique chaque semaine sur ce
  /// dayOfWeek. Défini = ponctuel, ne s'applique qu'à cette date précise — voir
  /// occurrenceAvailabilities (compute.ts), qui filtre une liste à ce qui s'applique
  /// réellement à une occurrence donnée avant de la passer à checkAvailability.
  date?: string | null;
};

export type PlanningMember = {
  membershipId: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  weeklyHoursTarget: number | null;
  maxShiftsPerWeek: number | null;
  employmentType: "fixe" | "flexijob";
  /// Postes tenus (voir Membership.skills) — jamais "direction", qui n'est pas une
  /// compétence qu'on coche (voir new-employee-form.tsx). C'est ce qui détermine
  /// l'éligibilité d'une personne à un créneau pour le générateur d'horaire.
  positions: ShiftPosition[];
};

export type ShiftWarning = { level: "warning" | "conflict"; message: string };

export type PlanningShift = {
  id: string;
  membershipId: string;
  date: string; // "yyyy-MM-dd"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  position: string;
  serviceId: string | null;
  serviceName: string | null;
  status: string;
  /// Niveau agrégé (le pire des signaux ci-dessous) — c'est lui qui pilote la couleur
  /// du badge sur le shift. Calculé une seule fois côté serveur par evaluateShift.
  conflictLevel: ShiftConflictLevel;
  /// Un par signal détecté (absence, chevauchement, disponibilité) — plusieurs peuvent
  /// coexister sur un même shift, chacun avec son propre niveau. La limite hebdomadaire
  /// n'y figure jamais : c'est un fait par personne-semaine, pas par shift.
  warnings: ShiftWarning[];
};

export type PlanningServiceDefinition = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[]; // 1=lundi..7=dimanche
};

/// Un service d'un jour donné — uniquement des faits (combien de couverts, combien de
/// personnes planifiées). Ne porte plus aucun niveau de charge : la fréquentation est
/// désormais un module séparé (frequentation), volontairement découplé du personnel.
export type PlanningDayService = {
  date: string; // "yyyy-MM-dd"
  dateLabel: string; // "Vendredi 12 septembre"
  serviceId: string;
  serviceName: string;
  covers: number;
  reservationsCount: number;
  staffCount: number;
};

export type PlanningAlertSeverity = "urgent" | "important" | "watch";

export type PlanningAlert = {
  id: string;
  severity: PlanningAlertSeverity;
  title: string;
  description?: string;
};

/// "atteint" : le nombre de services visé est déjà planifié.
/// "incomplet" : pas encore atteint, mais assez de créneaux compatibles restent pour
/// y arriver cette semaine.
/// "impossible" : les contraintes réelles (congés, indisponibilités) ne laissent plus
/// assez de créneaux compatibles pour atteindre l'objectif, même en les utilisant tous.
export type ServiceObjectiveStatus = "atteint" | "incomplet" | "impossible";

/// Un jour exclu des créneaux compatibles, et pourquoi — pour pouvoir dire "lundi :
/// indisponible" plutôt que de ne montrer que le chiffre final. Limité aux deux
/// contraintes qui bloquent une journée entière (voir isDayGenerallyUnavailable et
/// les congés approuvés) ; ne couvre pas un shift déjà planifié, qui n'est pas un
/// obstacle mais une avancée vers l'objectif.
export type ObjectiveExclusionReason = "indisponible" | "conge";
export type ObjectiveExclusion = { dateLabel: string; reason: ObjectiveExclusionReason };

export type ServiceObjective = {
  target: number;
  planned: number;
  remaining: number;
  compatibleSlotsRemaining: number;
  /// Libellés des jours (ex: "mercredi") qui restent compatibles avec les contraintes
  /// connues — pour expliquer, pas seulement afficher un chiffre.
  compatibleDayLabels: string[];
  /// Jours écartés et leur raison — le détail qui permet de comprendre "pourquoi il ne
  /// reste que X créneaux" sans deviner la logique interne du produit.
  excludedDays: ObjectiveExclusion[];
  status: ServiceObjectiveStatus;
};

export type WeekPlanningResult = {
  weekStart: string; // "yyyy-MM-dd", lundi
  weekDays: string[]; // 7 dates "yyyy-MM-dd"
  dayLabels: Record<string, string>; // "yyyy-MM-dd" -> "Lun. 7 sept."
  members: PlanningMember[];
  shifts: PlanningShift[];
  services: PlanningServiceDefinition[];
  dayServices: PlanningDayService[];
  /// Fréquentation par jour (pas par service : l'historique de CA n'est pas suivi à
  /// cette granularité) — un signal de demande, jamais croisé ici avec le personnel.
  dayFrequentation: { date: string; dateLabel: string; signal: FrequentationSignal }[];
  alerts: PlanningAlert[];
  /// Combien d'alertes la personne a rangées pour cette semaine (elles ne sont plus dans `alerts`).
  dismissedAlertCount: number;
  /// Résumé factuel de la semaine en quelques fragments courts (ex. "2 conflits à
  /// vérifier", "Chloé : 6/8 services") — jamais une recommandation, juste un compte
  /// de ce que le bandeau d'alertes détaille déjà plus bas.
  weekSummary: string[];
  totalHoursByMember: Record<string, number>;
  shiftsCountByMember: Record<string, number>;
  totalTeamHours: number;
  /// Seulement pour les membres avec un objectif de services défini (SchedulingRule) —
  /// l'absence d'entrée signifie "aucun objectif", jamais "objectif à 0".
  objectivesByMember: Record<string, ServiceObjective>;
  /// Le pire ShiftConflictLevel de la semaine pour chaque membre (shifts + limite
  /// hebdomadaire + objectif de services confondus) — pour le petit indicateur "un
  /// coup d'œil" à côté du nom.
  memberWeekStatus: Record<string, ShiftConflictLevel>;
  /// Nécessaire pour l'avertissement en temps réel dans la modale de création/édition
  /// (avant tout aller-retour serveur) — voir evaluateShift.
  availabilitiesByMember: Record<string, AvailabilityRow[]>;
  absentMembershipIdsByDate: Record<string, string[]>;
  canEdit: boolean;
  /// Rappels du manager sur la semaine affichée (voir PlanningNote) — visibles par
  /// tout le monde, y compris la vue simplifiée employé qui n'a ni alertes ni conflits.
  notes: PlanningNoteItem[];
  /// Besoins en personnel par (jour, service, poste) — seulement les combinaisons avec
  /// au moins une personne requise ; absent côté employé (jamais montré hors édition).
  requirements: StaffingRequirementCell[];
  /// Un par (jour, service, poste) qui a un besoin déclaré, couvert ou non — sert au
  /// liseré rouge sur la grille ; computeStaffingGapAlerts n'en garde que les creux.
  staffingGaps: StaffingGapSlot[];
  /// Demandes de renfort en cours sur la semaine affichée (voir CoverageRequest) —
  /// manager : pour savoir qui a déjà été sollicité·e et montrer où ça en est ; employé :
  /// jamais exposé ici (voir myspace/types.ts pour ses propres demandes à traiter).
  coverageRequests: CoverageRequestItem[];
};

export type CoverageRequestItem = {
  id: string;
  membershipId: string;
  memberName: string;
  date: string;
  dateLabel: string;
  serviceId: string | null;
  serviceName: string | null;
  startTime: string;
  endTime: string;
  position: ShiftPosition;
  status: "pending" | "accepted" | "declined";
};

/// Combien de personnes il faut à un (jour, service, poste) donné — voir
/// StaffingRequirement dans schema.prisma. C'est la cible que le générateur d'horaire
/// essaie d'atteindre ; une absence d'entrée pour une combinaison vaut 0.
export type StaffingRequirementCell = {
  dayOfWeek: number;
  serviceId: string;
  position: ShiftPosition;
  requiredCount: number;
};

/// Un (jour, service, poste) confronté à ce qui est réellement couvert — voir
/// computeStaffingGapAlerts (compute.ts) et le liseré rouge affiché directement sur la
/// grille (planning-app.tsx) quand assigned < required.
export type StaffingGapSlot = {
  date: string;
  dateLabel: string;
  serviceId: string;
  serviceName: string;
  position: ShiftPosition;
  required: number;
  assigned: number;
};

export type PlanningNoteItem = {
  id: string;
  date: string; // "yyyy-MM-dd"
  dateLabel: string;
  time: string | null;
  message: string;
  createdByName: string;
};
