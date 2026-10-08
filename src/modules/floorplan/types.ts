// Types du domaine "plan de salle". Séparés du reste pour rester la source de vérité
// partagée entre le calcul serveur (table-state.ts, queries.ts) et l'affichage (UI).

export const ZONE_TYPES = ["salle", "terrasse", "bar", "prive", "autre"] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export const TABLE_SHAPES = ["square", "round", "rect"] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

/// Statut MANUEL d'une table — posé par le staff, indépendant du service en cours.
export const TABLE_MANUAL_STATUSES = ["available", "unavailable", "cleaning"] as const;
export type TableManualStatus = (typeof TABLE_MANUAL_STATUSES)[number];

/// État affiché sur le plan — calculé, jamais stocké tel quel (voir table-state.ts).
export type TableLiveState = "available" | "soon" | "reserved" | "occupied" | "cleaning" | "unavailable";

export type TableUpcomingReservation = {
  id: string;
  customerName: string;
  partySize: number;
  time: string;
  status: string;
  minutesFromNow: number;
};

export type TableWithLiveState = {
  id: string;
  zoneId: string;
  label: string;
  capacity: number;
  shape: TableShape;
  posX: number;
  posY: number;
  width: number;
  height: number;
  manualStatus: TableManualStatus;
  liveState: TableLiveState;
  /// La réservation qui explique l'état live (occupée / réservée / bientôt), s'il y en a une.
  activeReservation: TableUpcomingReservation | null;
  /// Seulement en aperçu d'un jour choisi : toutes les réservations de la fenêtre, par heure.
  dayReservations?: TableUpcomingReservation[];
  group: { id: string; label: string | null; combinedCapacity: number; tableIds: string[] } | null;
};

export type ZoneWithTables = {
  id: string;
  name: string;
  type: ZoneType;
  sortOrder: number;
  tables: TableWithLiveState[];
};
