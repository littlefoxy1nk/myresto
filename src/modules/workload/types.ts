// Types du calcul de charge. Volontairement indépendants de Prisma : ce module doit
// pouvoir être appelé depuis Today, Mode Service, le futur Planning, Insights ou l'IA
// sans qu'aucun d'eux n'ait à connaître la forme des tables en base.

export type WorkloadReservation = {
  time: string; // "HH:MM"
  partySize: number;
  /// Zone déduite par l'appelant à partir des tables associées à la réservation — ce
  /// module ne sait pas résoudre une table vers une zone, il consomme le résultat déjà fait.
  zoneId: string | null;
};

export type WorkloadZoneInput = {
  id: string;
  name: string;
  tablesCount: number;
  assignedStaffCount: number;
};

export type ZoneWorkload = {
  zoneId: string;
  zoneName: string;
  covers: number;
  reservationsCount: number;
  tablesCount: number;
  /// Un fait (qui est affecté à cette zone), jamais transformé en ratio couverts/personnel.
  assignedStaffCount: number;
};

export type ArrivalWindow = {
  startTime: string; // "19:00"
  covers: number;
  reservationsCount: number;
};

export type WorkloadSummary = {
  totalCovers: number;
  totalReservations: number;
  totalTables: number;
  byZone: ZoneWorkload[];
  /// Uniquement les créneaux qui ont au moins une arrivée — pas 48 lignes à 0 pour une soirée.
  arrivalConcentration: ArrivalWindow[];
};

/// Tension d'une zone EN CE MOMENT (Mode Service) — jamais un calcul de personnel :
/// uniquement occupation physique réelle + arrivées imminentes déjà connues.
export type ZonePressureLevel = "calme" | "chargee" | "pleine";
