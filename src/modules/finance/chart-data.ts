import { isoWeekday } from "@/lib/time";

/// Une valeur par jour / par mois, quelle que soit la mesure (CA en centimes, couverts, nombre
/// de réservations) : toutes les courbes suivent la même logique.
export type DayValue = { date: string; value: number };
export type MonthValue = { year: number; month: number; value: number };

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;
export const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"] as const;

export type MonthTotal = {
  year: number;
  month: number; // 1..12
  value: number;
  /// "month" = total du mois saisi tel quel ; "days" = somme des jours saisis.
  source: "month" | "days";
};

/// Valeur de chaque mois : le total saisi pour le mois entier s'il existe (c'est ce que la
/// personne a déclaré pour tout le mois), sinon la somme des jours saisis.
export function monthTotals(days: DayValue[], months: MonthValue[]): Map<string, MonthTotal> {
  const out = new Map<string, MonthTotal>();
  for (const d of days) {
    const [y, m] = d.date.split("-").map(Number);
    const key = `${y}-${m}`;
    const entry = out.get(key) ?? { year: y, month: m, value: 0, source: "days" as const };
    entry.value += d.value;
    out.set(key, entry);
  }
  for (const f of months) {
    out.set(`${f.year}-${f.month}`, { year: f.year, month: f.month, value: f.value, source: "month" });
  }
  return out;
}

export function yearsPresent(days: DayValue[], months: MonthValue[]): number[] {
  const years = new Set<number>();
  for (const d of days) years.add(Number(d.date.slice(0, 4)));
  for (const m of months) years.add(m.year);
  return [...years].sort((a, b) => a - b);
}

export type Series = { key: string; label: string; points: (number | null)[] };

/// Une courbe par année sur 12 mois (null = mois sans chiffre : la courbe s'interrompt).
export function monthSeries(totals: Map<string, MonthTotal>, years: number[]): Series[] {
  return years.map((year) => ({
    key: String(year),
    label: String(year),
    points: Array.from({ length: 12 }, (_, i) => totals.get(`${year}-${i + 1}`)?.value ?? null),
  }));
}

/// Une courbe par année sur les 7 jours de la semaine, à partir des JOURS saisis seulement
/// (un total de mois n'a pas de jour de semaine). "avg" = moyenne par jour saisi — c'est elle
/// qui compare honnêtement un samedi à un mardi, quel que soit le nombre de samedis dans la période.
export function weekdaySeries(
  days: DayValue[],
  years: number[],
  monthsFilter: Set<number>,
  mode: "avg" | "total"
): Series[] {
  return years.map((year) => {
    const sums = Array<number>(7).fill(0);
    const counts = Array<number>(7).fill(0);
    for (const d of days) {
      const [y, m] = d.date.split("-").map(Number);
      if (y !== year || !monthsFilter.has(m)) continue;
      const idx = isoWeekday(new Date(`${d.date}T00:00:00`)) - 1;
      sums[idx] += d.value;
      counts[idx] += 1;
    }
    return {
      key: String(year),
      label: String(year),
      points: sums.map((sum, i) => (counts[i] === 0 ? null : mode === "avg" ? Math.round(sum / counts[i]) : sum)),
    };
  });
}

export type YearTotal = { year: number; value: number; monthsCovered: number };

/// Total de chaque année et nombre de mois renseignés (un total sur 3 mois ne se compare pas à un total sur 12).
export function yearTotals(totals: Map<string, MonthTotal>, years: number[]): YearTotal[] {
  return years.map((year) => {
    let value = 0;
    let monthsCovered = 0;
    for (let m = 1; m <= 12; m++) {
      const t = totals.get(`${year}-${m}`);
      if (t) {
        value += t.value;
        monthsCovered += 1;
      }
    }
    return { year, value, monthsCovered };
  });
}
