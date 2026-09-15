import type { ZoneWithTables } from "@/modules/floorplan/types";
import type { ZonePressureLevel } from "@/modules/workload/types";

export type TimelineEntry = {
  reservationId: string;
  time: string;
  customerName: string;
  partySize: number;
  tableLabels: string[];
  status: string;
  minutesFromNow: number;
  isPast: boolean;
};

export type ServiceAlertKind = "occupied_conflict" | "cleaning_conflict";

export type ServiceAlert = {
  id: string;
  kind: ServiceAlertKind;
  title: string;
  description: string;
  action: { label: string; kind: "release" | "mark_ready"; targetId: string };
};

export type ServiceWindow = { name: string; startTime: string; endTime: string } | null;

export type ServiceSnapshot = {
  now: string; // ISO — pour affichage horaire côté client sans re-calculer le fuseau
  hasStarted: boolean;
  currentService: ServiceWindow;
  nextService: (ServiceWindow & { minutesFromNow: number }) | null;
  expectedCovers: number;
  reservationsRemaining: number;
  tablesOccupied: number;
  tablesReserved: number;
  tablesToPrep: number;
  totalTables: number;
  alerts: ServiceAlert[];
  nextUp: TimelineEntry[];
  timeline: TimelineEntry[];
  zones: ZoneWithTables[];
  /// Par id de zone — la tension de chaque zone en ce moment, pour repérer d'un coup
  /// d'œil laquelle absorbe le plus de pression pendant le service.
  zonePressure: Record<string, ZonePressureLevel>;
};
