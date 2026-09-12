// Types du Planning RH V1. Volontairement indépendants de Prisma pour que compute.ts
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

export type PlanningMember = {
  membershipId: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  weeklyHoursTarget: number | null;
};

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
  /// Calculé côté serveur une fois pour toutes via detectOverlappingShiftIds — évite
  /// de refaire la détection à chaque rendu client.
  hasOverlap: boolean;
  /// La personne a un congé approuvé qui couvre ce jour alors qu'elle est planifiée.
  isAbsentConflict: boolean;
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
  absentScheduled: { membershipId: string; name: string }[];
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
  totalTeamHours: number;
  canEdit: boolean;
};
