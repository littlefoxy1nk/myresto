import { timeToMinutes } from "@/lib/time";

/// Le plan de salle « version papier » : pour un jour, UNE feuille avec un plan par service (12h, 18h, 20h30…) côte à côte ;
/// en lignes, les tables de toutes les salles dans l'ordre numérique, et pour chacune l'heure, le nombre de personnes, le nom et le GSM. Ce fichier ne fait que ranger les
/// données (fonctions pures, testées) ; le dessin du PDF est dans paper-plan-pdf.ts.

export type PaperEntry = { time: string; partySize: number; name: string; phone: string };

/// Une table, et ce qui y est prévu dans chaque colonne de la feuille (`entries[i]` = colonne i, triée par heure).
export type PaperRow = { label: string; entries: PaperEntry[][] };

export type PaperSection = { title: string; subtitle: string | null };

export type PaperSheet = {
  dateKey: string;
  /// Le nom de la salle quand la feuille n'en couvre qu'une ; null = toutes les salles réunies.
  zoneName: string | null;
  sections: PaperSection[];
  rows: PaperRow[];
};

export type PaperService = { id: string; name: string; startTime: string; endTime: string };
export type PaperZone = { id: string; name: string; sortOrder: number; tables: { id: string; label: string }[] };
export type PaperReservation = { customerName: string; customerPhone?: string | null; partySize: number; time: string; tableIds: string[] };

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

/// Le premier nombre d'un libellé : « 12 » → 12, « T3 » → 3, « Table 7 » → 7. Sans nombre : null.
function tableNumber(label: string): number | null {
  const m = label.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/// Les tables dans l'ordre numérique, d'après le NOMBRE du libellé et non ses lettres : 1, 2, 3… 9, 10, 11, même si
/// certaines s'appellent « T1 » ou « Table 2 » et d'autres « 7 ». Les libellés sans nombre viennent en dernier.
export function sortTableLabels<T extends { label: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => {
    const na = tableNumber(a.label);
    const nb = tableNumber(b.label);
    if (na !== nb) {
      if (na === null) return 1;
      if (nb === null) return -1;
      return na - nb;
    }
    return a.label.localeCompare(b.label, "fr", { numeric: true, sensitivity: "base" });
  });
}

/// La feuille d'UN jour. `services` = les services de ce jour de la semaine (aucun → un seul plan « Journée »).
/// `reservations` = celles du jour, sans les annulées ni les absents. Avec `combine`, toutes les salles sont réunies sur une
/// seule feuille, tables dans l'ordre numérique ; sinon une feuille par salle. Avec `includeUnassigned`, les réservations sans
/// table sont ajoutées en bas de la dernière feuille pour qu'aucune ne manque sur le papier.
export function buildPaperSheets(params: {
  dateKey: string;
  zones: PaperZone[];
  services: PaperService[];
  reservations: PaperReservation[];
  includeUnassigned: boolean;
  combine?: boolean;
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
    const entry: PaperEntry = { time: r.time, partySize: r.partySize, name: r.customerName, phone: r.customerPhone?.trim() ?? "" };
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

  const rowOf = (t: { id: string; label: string }): PaperRow => ({
    label: t.label,
    entries: (byTable.get(t.id) ?? emptyEntries()).map((list) => [...list].sort(byTime)),
  });

  const zones = [...params.zones].sort((a, b) => a.sortOrder - b.sortOrder).filter((z) => z.tables.length > 0);
  const sheets: PaperSheet[] = params.combine
    ? zones.length === 0
      ? []
      : [{ dateKey: params.dateKey, zoneName: null, sections, rows: sortTableLabels(zones.flatMap((z) => z.tables)).map(rowOf) }]
    : zones.map((zone) => ({ dateKey: params.dateKey, zoneName: zone.name, sections, rows: sortTableLabels(zone.tables).map(rowOf) }));

  if (params.includeUnassigned && sheets.length > 0 && unassigned.some((list) => list.length > 0)) {
    sheets[sheets.length - 1].rows.push({ label: "Sans table", entries: unassigned.map((list) => [...list].sort(byTime)) });
  }
  return sheets;
}
