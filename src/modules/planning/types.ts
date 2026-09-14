// Types du Planning RH. Volontairement indépendants de Prisma pour que compute.ts
// reste une fonction pure, testable sans base de données (même convention que le
// module workload).

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

export type DemandLevel = "indeterminee" | "faible" | "moderee" | "elevee";

export type PlanningDayService = {
  date: string; // "yyyy-MM-dd"
  dateLabel: string; // "Vendredi 12 septembre"
  serviceId: string;
  serviceName: string;
  covers: number;
  reservationsCount: number;
  staffCount: number;
  /// Personnel en position "salle" uniquement — c'est ce sous-ensemble, pas l'équipe
  /// complète (cuisine/bar/direction comprise), qui a un rapport réel avec le nombre de
  /// couverts en salle. Utilisé pour les alertes de cohérence, jamais pour l'affichage
  /// brut de "personnel planifié" qui reste l'équipe complète.
  floorStaffCount: number;
  demandLevel: DemandLevel;
};

export type PlanningAlertSeverity = "urgent" | "important" | "watch";

export type PlanningAlert = {
  id: string;
  severity: PlanningAlertSeverity;
  title: string;
  description?: string;
};

export type WeekPlanningResult = {
  weekStart: string; // "yyyy-MM-dd", lundi
  weekDays: string[]; // 7 dates "yyyy-MM-dd"
  dayLabels: Record<string, string>; // "yyyy-MM-dd" -> "Lun. 7 sept."
  members: PlanningMember[];
  shifts: PlanningShift[];
  services: PlanningServiceDefinition[];
  dayServices: PlanningDayService[];
  alerts: PlanningAlert[];
  totalHoursByMember: Record<string, number>;
  shiftsCountByMember: Record<string, number>;
  totalTeamHours: number;
  /// Le pire ShiftConflictLevel de la semaine pour chaque membre (shifts + limite
  /// hebdomadaire confondus) — pour le petit indicateur "un coup d'œil" à côté du nom.
  memberWeekStatus: Record<string, ShiftConflictLevel>;
  /// Nécessaire pour l'avertissement en temps réel dans la modale de création/édition
  /// (avant tout aller-retour serveur) — voir evaluateShift.
  availabilitiesByMember: Record<string, AvailabilityRow[]>;
  absentMembershipIdsByDate: Record<string, string[]>;
  canEdit: boolean;
};
