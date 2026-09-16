/// Types de l'espace personnel — ce que CHACUN voit sur soi-même, quel que soit son
/// rôle. Volontairement plus simple que les types équivalents de Planning/Congés
/// (pas de conflictLevel, pas de comparaison à l'équipe) : un employé regarde ses
/// propres horaires, pas la grille complète.

export type MyShift = {
  id: string;
  date: string; // "yyyy-MM-dd"
  dateLabel: string; // "Samedi 20 septembre"
  startTime: string;
  endTime: string;
  serviceName: string | null;
  position: string;
};

export type MyObjective = {
  target: number;
  planned: number;
  remaining: number;
};

export type MyTimeOffStatus = "pending" | "approved" | "rejected";

export type MyTimeOffRequest = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: MyTimeOffStatus;
  createdAt: string;
};

export type MyNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkHref: string | null;
  isRead: boolean;
  createdAt: string;
};

export type MyDashboard = {
  memberName: string;
  firstName: string;
  jobTitle: string | null;
  /// Le ou les shifts d'aujourd'hui — rarement plus d'un, mais on ne suppose pas.
  todayShifts: MyShift[];
  weekShifts: MyShift[];
  weekShiftsCount: number;
  /// null si aucun objectif n'a été défini pour cette personne — jamais 0, qui
  /// laisserait croire à un objectif réel de "zéro service".
  objective: MyObjective | null;
  timeOffRequests: MyTimeOffRequest[];
  notifications: MyNotification[];
  unreadNotificationsCount: number;
  hasCode: boolean;
  hasEmail: boolean;
  username: string | null;
  /// Jours (1=lundi..7=dimanche) déclarés indisponibles toute la journée — voir
  /// setMyDayUnavailability. Simple liste, pas de plage horaire.
  unavailableDays: number[];
};
