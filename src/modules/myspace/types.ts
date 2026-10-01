/// Types de l'espace personnel — ce que CHACUN voit sur soi-même, quel que soit son
/// rôle. Volontairement plus simple que les types équivalents de Planning/Congés
/// (pas de conflictLevel, pas de comparaison à l'équipe) : un employé regarde ses
/// propres horaires, pas la grille complète.

import type { MyReplacementOpportunity } from "@/modules/replacement/types";

export type MyShift = {
  id: string;
  date: string; // "yyyy-MM-dd"
  dateLabel: string; // "Samedi 20 septembre"
  startTime: string;
  endTime: string;
  serviceName: string | null;
  position: string;
  /// Un remplacement est déjà en cours de recherche pour ce shift — évite de proposer
  /// le bouton "je ne peux pas assurer ce service" une seconde fois.
  hasOpenReplacementRequest: boolean;
};

export type MyObjective = {
  target: number;
  planned: number;
  remaining: number;
};

export type MyTimeOffStatus = "pending" | "approved" | "rejected";
export type MyTimeOffKind = "conge" | "maladie";

export type MyTimeOffRequest = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: MyTimeOffStatus;
  kind: MyTimeOffKind;
  createdAt: string;
  document: { id: string; originalName: string } | null;
};

export type MyAvailabilityService = {
  id: string;
  name: string;
  /// 1=lundi..7=dimanche — pour ne proposer une case à cocher que les jours où ce
  /// service tourne réellement (voir ServiceDefinition.daysOfWeek).
  daysOfWeek: number[];
};

export type MyNotification = {
  id: string;
  type: string;
  severity: "urgent" | "important" | "watch";
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
  /// Remplacements ouverts ailleurs, pour lesquels cette personne est factuellement
  /// éligible — voir replacement/compute.ts.
  replacementOpportunities: MyReplacementOpportunity[];
  /// null si aucun objectif n'a été défini pour cette personne — jamais 0, qui
  /// laisserait croire à un objectif réel de "zéro service".
  objective: MyObjective | null;
  timeOffRequests: MyTimeOffRequest[];
  notifications: MyNotification[];
  unreadNotificationsCount: number;
  hasCode: boolean;
  hasEmail: boolean;
  username: string | null;
  /// fixe = horaire habituel déclaré par le manager, lecture seule ici (voir
  /// employmentType sur Membership) ; flexijob = modifiable directement par la
  /// personne, voir AvailabilityToggles et setMyUsualAvailability.
  employmentType: "fixe" | "flexijob";
  /// Services de l'établissement, pour la grille "par service" — vide tant que le
  /// patron n'a configuré aucun service (voir ServiceDefinition).
  availabilityServices: MyAvailabilityService[];
  /// Horaire habituel (récurrent, chaque semaine) : une entrée par (jour, service) où
  /// la personne travaille normalement — déclaré par le manager pour un·e fixe, par
  /// la personne elle-même pour un·e flexijob.
  usualAvailabilityCells: { dayOfWeek: number; serviceId: string }[];
  /// Disponibilités ponctuelles ajoutées "en plus" pour la semaine affichée (voir
  /// addMyOneOffAvailability) — jamais une modification de l'horaire habituel,
  /// toujours libre de retirer à tout moment, quel que soit le statut.
  oneOffAvailability: { id: string; date: string; serviceId: string }[];
  /// Les 7 dates ("yyyy-MM-dd", lundi→dimanche) de la semaine calendaire en cours,
  /// calculées côté serveur — pour proposer les bons jours à l'ajout ponctuel sans
  /// recalculer "aujourd'hui" côté client (fuseau horaire, horloge).
  currentWeekDates: string[];
  /// Demandes de renfort du manager en attente de réponse — voir CoverageRequest. Jamais
  /// un shift tant que la personne n'a pas répondu oui (voir respondToCoverageRequest).
  coverageRequests: MyCoverageRequest[];
};

export type MyCoverageRequest = {
  id: string;
  date: string;
  dateLabel: string;
  serviceName: string | null;
  startTime: string;
  endTime: string;
  position: string;
};
