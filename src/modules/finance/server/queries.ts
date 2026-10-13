import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from "date-fns";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { CLOSING_SOURCE } from "@/modules/finance/server/shared";
import { computeAverageTicket } from "@/modules/finance/compute";
import { buildHistoryDatasets, type HistoryDatasets } from "@/modules/finance/history";
import { computeShiftDurationHours } from "@/modules/planning/compute";
import type { FinanceSummary } from "@/modules/finance/types";

/// Chiffres clés des derniers jours (CA, couverts, panier moyen, heures planifiées), à partir des
/// seules données réellement enregistrées — aucun chiffre n'est simulé. Les heures planifiées
/// viennent de Shift (Planning) mais sont recalculées ici plutôt que d'appeler getWeekPlanning, pour
/// ne pas coupler l'accès aux finances à la permission schedule.view.
export async function getFinanceSummary(establishmentId: string, rangeDays = 14): Promise<FinanceSummary> {
  const ctx = await getCurrentContext();
  if (!ctx.can("finance.view")) throw new ForbiddenError("finance.view");

  const rangeStart = startOfDay(subDays(new Date(), rangeDays - 1));
  const rangeEnd = endOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const [revenueEntries, weekShifts] = await Promise.all([
    prisma.revenueEntry.findMany({ where: { establishmentId, date: { gte: rangeStart, lte: rangeEnd } } }),
    prisma.shift.findMany({
      where: { establishmentId, date: { gte: weekStart, lte: weekEnd }, status: { not: "cancelled" } },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const totalRevenueCents = revenueEntries.reduce((s, r) => s + r.amountCents, 0);
  const totalCovers = revenueEntries.reduce((s, r) => s + r.covers, 0);
  const plannedHoursThisWeek = weekShifts.reduce((s, sh) => s + computeShiftDurationHours(sh.startTime, sh.endTime), 0);

  return {
    rangeDays,
    totalRevenueCents,
    totalCovers,
    averageTicketCents: computeAverageTicket(revenueEntries.map((r) => ({ amountCents: r.amountCents, covers: r.covers }))),
    plannedHoursThisWeek,
  };
}

/// Le CA du jour déjà saisi (le cas échéant), pour pré-remplir le formulaire de clôture
/// plutôt que de laisser le manager repartir de zéro ou créer un doublon. Vérification
/// interne pour ne jamais dépendre uniquement d'un futur appelant qui l'aurait oubliée.
export async function getTodayClosing(establishmentId: string): Promise<{ revenueCents: number; covers: number } | null> {
  const ctx = await getCurrentContext();
  if (!ctx.can("finance.manage")) throw new ForbiddenError("finance.manage");

  const today = startOfDay(new Date());
  const entry = await prisma.revenueEntry.findFirst({
    where: { establishmentId, source: CLOSING_SOURCE, date: today },
  });
  return entry ? { revenueCents: entry.amountCents, covers: entry.covers } : null;
}

/// Tout l'historique utile aux graphiques : CA saisi (jours + mois), couverts, et réservations
/// réellement honorées (arrivées, installées ou terminées, jusqu'à aujourd'hui).
export async function getFinanceHistory(establishmentId: string): Promise<HistoryDatasets> {
  const ctx = await getCurrentContext();
  if (!ctx.can("finance.view")) throw new ForbiddenError("finance.view");

  const [revenue, monthly, done] = await Promise.all([
    prisma.revenueEntry.findMany({ where: { establishmentId }, select: { date: true, amountCents: true, covers: true } }),
    prisma.monthlyFigure.findMany({ where: { establishmentId } }),
    prisma.reservation.findMany({
      where: {
        establishmentId,
        status: { in: ["arrived", "seated", "completed"] },
        date: { lte: endOfDay(new Date()) },
      },
      select: { date: true, partySize: true },
    }),
  ]);

  return buildHistoryDatasets(
    revenue.map((r) => ({ date: toDateKey(r.date), amountCents: r.amountCents, covers: r.covers })),
    monthly.map((m) => ({ year: m.year, month: m.month, amountCents: m.amountCents, covers: m.covers })),
    done.map((r) => ({ date: toDateKey(r.date), partySize: r.partySize }))
  );
}
