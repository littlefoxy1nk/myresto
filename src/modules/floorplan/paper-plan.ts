import { timeToMinutes } from "@/lib/time";

/// Le plan de salle « version papier » : pour un jour, une feuille par salle, avec une colonne par service
/// et, pour chaque table, l'heure, le nombre de personnes et le nom. Ce fichier ne fait que ranger les
/// données (fonctions pures, testées) ; le dessin du PDF est dans paper-plan-pdf.ts.

export type PaperEntry = { time: string; partySize: number; name: string };

/// Une table, et ce qui y est prévu dans chaque colonne de la feuille (`entries[i]` = colonne i, triée par heure).
export type PaperRow = { label: string; entries: PaperEntry[][] };

export type PaperSection = { title: string; subtitle: string | null };

export type PaperSheet = {
  dateKey: string;
  zoneName: string;
  sections: PaperSection[];
  rows: PaperRow[];
};

export type PaperService = { id: string; name: string; startTime: string; endTime: string };
export type PaperZone = { id: string; name: string; sortOrder: number; tables: { id: string; label: string }[] };
export type PaperReservation = { customerName: string; partySize: number; time: string; tableIds: string[] };

/// Dans quel service tombe une arrivée : celui dans lequel elle a lieu ; entre deux services, le suivant
/// (client en avance) ; avant le premier, le premier ; après le dernier, le dernier. `services` est trié par heure de début.
export function serviceIndexFor(time: string, services: PaperService[]): number {
  if (services.length === 0) return 0;
  const t = timeToMinutes(time);
  for (let i = 0; i < services.length; i++) {
    if (t < timeToMinutes(services[i].endTime)) return i;
  }
  return services.length - 1;
}

const byTime = (a: PaperEntry, b: PaperEntry) => timeToMinutes(a.time) - timeToMinutes(b.time) || a.name.localeCompare(b.name, "fr");

/// Les tables dans l'ordre naturel (1, 2, 10 et non 1, 10, 2).
export function sortTableLabels<T extends { label: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true, sensitivity: "base" }));
}

/// Les feuilles d'UN jour. `services` = les services de ce jour de la semaine (aucun → une seule colonne « Journée »).
/// `reservations` = celles du jour, sans les annulées ni les absents. Avec `includeUnassigned`, les réservations
/// sans table sont ajoutées en bas de la dernière feuille pour qu'aucune ne manque sur le papier.
export function buildPaperSheets(params: {
  dateKey: string;
  zones: PaperZone[];
  services: PaperService[];
  reservations: PaperReservation[];
  includeUnassigned: boolean;
}): PaperSheet[] {
  const services = [...params.services].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const sections: PaperSection[] =
    services.length > 0
      ? services.map((s) => ({ title: s.name, subtitle: `${s.startTime} – ${s.endTime}` }))
      : [{ title: "Journée", subtitle: null }];
  const columnCount = sections.length;

  const emptyEntries = () => Array.from({ length: columnCount }, () => [] as PaperEntry[]);
  const columnOf = (time: string) => (services.length > 0 ? serviceIndexFor(time, services) : 0);

  const byTable = new Map<string, PaperEntry[][]>();
  const unassigned = emptyEntries();
  for (const r of params.reservations) {
    const entry: PaperEntry = { time: r.time, partySize: r.partySize, name: r.customerName };
    const column = columnOf(r.time);
    if (r.tableIds.length === 0) {
      unassigned[column].push(entry);
      continue;
    }
    for (const tableId of r.tableIds) {
      const cols = byTable.get(tableId) ?? emptyEntries();
      cols[column].push(entry);
      byTable.set(tableId, cols);
    }
  }

  const sheets: PaperSheet[] = [...params.zones]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((z) => z.tables.length > 0)
    .map((zone) => ({
      dateKey: params.dateKey,
      zoneName: zone.name,
      sections,
      rows: sortTableLabels(zone.tables).map((t) => ({
        label: t.label,
        entries: (byTable.get(t.id) ?? emptyEntries()).map((list) => [...list].sort(byTime)),
      })),
    }));

  if (params.includeUnassigned && sheets.length > 0 && unassigned.some((list) => list.length > 0)) {
    sheets[sheets.length - 1].rows.push({ label: "Sans table", entries: unassigned.map((list) => [...list].sort(byTime)) });
  }
  return sheets;
}
