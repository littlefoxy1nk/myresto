import type { DayValue, MonthValue } from "./chart-data";

export type RevenueRow = { date: string; amountCents: number; covers: number };
export type MonthlyRow = { year: number; month: number; amountCents: number; covers: number };
/// Une réservation réellement honorée (arrivée, installée ou terminée).
export type DoneReservationRow = { date: string; partySize: number };

export type Dataset = { days: DayValue[]; months: MonthValue[] };

export type HistoryDatasets = { revenue: Dataset; covers: Dataset; reservations: Dataset };

/// Prépare les trois jeux de données des graphiques.
/// - CA : tel que saisi (jours + totaux de mois).
/// - Couverts : ceux saisis (clôture du jour / total du mois) quand ils existent, sinon ceux des
///   réservations réellement honorées ce jour-là — jamais les deux additionnés (pas de double compte).
/// - Réservations : le nombre de réservations honorées, compté dans l'application.
export function buildHistoryDatasets(
  revenueRows: RevenueRow[],
  monthlyRows: MonthlyRow[],
  doneReservations: DoneReservationRow[]
): HistoryDatasets {
  const revenueByDay = new Map<string, number>();
  const enteredCoversByDay = new Map<string, number>();
  for (const r of revenueRows) {
    revenueByDay.set(r.date, (revenueByDay.get(r.date) ?? 0) + r.amountCents);
    enteredCoversByDay.set(r.date, (enteredCoversByDay.get(r.date) ?? 0) + r.covers);
  }

  const reservationCountByDay = new Map<string, number>();
  const reservationCoversByDay = new Map<string, number>();
  for (const r of doneReservations) {
    reservationCountByDay.set(r.date, (reservationCountByDay.get(r.date) ?? 0) + 1);
    reservationCoversByDay.set(r.date, (reservationCoversByDay.get(r.date) ?? 0) + r.partySize);
  }

  const coverDates = new Set([...enteredCoversByDay.keys(), ...reservationCoversByDay.keys()]);
  const coversDays: DayValue[] = [...coverDates]
    .map((date) => {
      const entered = enteredCoversByDay.get(date) ?? 0;
      return { date, value: entered > 0 ? entered : (reservationCoversByDay.get(date) ?? 0) };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    revenue: {
      days: [...revenueByDay].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
      months: monthlyRows.map((m) => ({ year: m.year, month: m.month, value: m.amountCents })),
    },
    covers: {
      days: coversDays,
      months: monthlyRows.filter((m) => m.covers > 0).map((m) => ({ year: m.year, month: m.month, value: m.covers })),
    },
    reservations: {
      days: [...reservationCountByDay].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
      months: [],
    },
  };
}
