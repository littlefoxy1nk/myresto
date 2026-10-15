import { timeToMinutes } from "@/lib/time";
import { EVENING_START_MINUTES } from "@/modules/service/spans";

export type PlanningView = "service" | "periode";
export const PLANNING_VIEWS: { key: PlanningView; label: string }[] = [
  { key: "service", label: "Par service" },
  { key: "periode", label: "Midi / Soir" },
];

export function isPlanningView(value: unknown): value is PlanningView {
  return value === "service" || value === "periode";
}

type ServiceLike = { id: string; name: string; startTime: string; endTime: string; daysOfWeek: number[] };

export type PlanningRow = {
  id: string;
  name: string;
  time: string | null;
  /// Les services regroupés dans cette ligne ("none" = les shifts sans service).
  serviceIds: string[];
  /// null = toujours actif (la ligne "sans service").
  daysOfWeek: number[] | null;
};

const periodOf = (s: { startTime: string }) => (timeToMinutes(s.startTime) >= EVENING_START_MINUTES ? "soir" : "midi");

/// Les lignes du planning : une par service ("service"), ou juste Midi et Soir ("periode", les services avant 17h
/// regroupés sous Midi, les autres sous Soir). Une ligne "Sans service" s'ajoute si des shifts n'en ont aucun.
export function buildPlanningRows(services: ServiceLike[], view: PlanningView, hasShiftsWithoutService: boolean): PlanningRow[] {
  const sorted = [...services].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  let rows: PlanningRow[];

  if (view === "periode") {
    rows = (["midi", "soir"] as const).flatMap((period) => {
      const group = sorted.filter((s) => periodOf(s) === period);
      if (group.length === 0) return [];
      const start = group[0].startTime;
      const end = group.reduce((latest, s) => (timeToMinutes(s.endTime) > timeToMinutes(latest) ? s.endTime : latest), group[0].endTime);
      return [
        {
          id: `periode-${period}`,
          name: period === "midi" ? "Midi" : "Soir",
          time: `${start}–${end}`,
          serviceIds: group.map((s) => s.id),
          daysOfWeek: [...new Set(group.flatMap((s) => s.daysOfWeek))].sort((a, b) => a - b),
        },
      ];
    });
  } else {
    rows = sorted.map((s) => ({ id: s.id, name: s.name, time: `${s.startTime}–${s.endTime}`, serviceIds: [s.id], daysOfWeek: s.daysOfWeek }));
  }

  if (hasShiftsWithoutService) rows.push({ id: "none", name: "Sans service", time: null, serviceIds: ["none"], daysOfWeek: null });
  return rows;
}

/// Le manque d'une ligne, par poste. Pour plusieurs services regroupés, on garde le PIRE manque d'un des services
/// (jamais leur somme : une même personne qui fait toute la soirée compte dans chacun, la sommer compterait deux fois).
export function worstGapsByPosition(gaps: { position: string; required: number; assigned: number }[]): { position: string; missing: number }[] {
  const worst = new Map<string, number>();
  for (const g of gaps) {
    const missing = g.required - g.assigned;
    if (missing > 0) worst.set(g.position, Math.max(worst.get(g.position) ?? 0, missing));
  }
  return [...worst].map(([position, missing]) => ({ position, missing }));
}

/// Le service par défaut quand on ajoute un shift depuis une ligne : le premier service de la ligne actif ce jour-là.
export function defaultServiceForRow(row: PlanningRow, services: ServiceLike[], isoDay: number): string | null {
  if (row.serviceIds[0] === "none") return null;
  const active = row.serviceIds
    .map((id) => services.find((s) => s.id === id))
    .find((s): s is ServiceLike => !!s && s.daysOfWeek.includes(isoDay));
  return (active ?? services.find((s) => s.id === row.serviceIds[0]))?.id ?? null;
}

/// Un shift aux horaires « habituels » d'une ligne n'a pas besoin de les répéter : il commence quand un des services de
/// la ligne commence et finit quand un des services de la ligne finit (donc aussi toute la soirée, d'un service au
/// suivant). Seuls les horaires qui sortent de l'ordinaire s'affichent sur la pastille.
export function hasUsualHours(
  shift: { startTime: string; endTime: string },
  rowServiceIds: string[],
  services: { id: string; startTime: string; endTime: string }[]
): boolean {
  const row = rowServiceIds.map((id) => services.find((x) => x.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  return row.some((s) => s.startTime === shift.startTime) && row.some((s) => s.endTime === shift.endTime);
}

export type DayColumn = { date: string; closed: boolean; isToday: boolean; isPast: boolean };

/// L'état de chaque jour de la grille : « fermé » quand aucune ligne n'a lieu ce jour-là (la colonne se replie au lieu
/// de prendre de la place pour rien), aujourd'hui mis en avant, les jours passés atténués.
export function describeDays(weekDays: string[], rows: { daysOfWeek: number[] | null }[], todayKey: string, isoDayOf: (dateKey: string) => number): DayColumn[] {
  return weekDays.map((date) => ({
    date,
    closed: rows.length > 0 && rows.every((r) => r.daysOfWeek !== null && !r.daysOfWeek.includes(isoDayOf(date))),
    isToday: date === todayKey,
    isPast: date < todayKey,
  }));
}
