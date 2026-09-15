// Types du Planning RH. Volontairement indépendants de Prisma pour que compute.ts
// reste une fonction pure, testable sans base de données (même convention que le
// module workload).

import type { FrequentationSignal } from "@/modules/frequentation/types";

export const SHIFT_POSITIONS = ["salle", "cuisine", "bar", "direction"] as const;
export type ShiftPosition = (typeof SHIFT_POSITIONS)[number];

export const SHIFT_POSITION_LABELS: Record<ShiftPosition, string> = {
  salle: "Salle",
  cuisine: "Cuisine",
  bar: "Bar",
  direction: "Direction",
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
};

export type PlanningMember = {
  membershipId: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  weeklyHoursTarget: number | null;
  maxShiftsPerWeek: number | null;
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

export type ServiceObjective = {
  target: number;
  planned: number;
  remaining: number;
  compatibleSlotsRemaining: number;
  /// Libellés des jours (ex: "mercredi") qui restent compatibles avec les contraintes
  /// connues — pour expliquer, pas seulement afficher un chiffre.
  compatibleDayLabels: string[];
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
};
