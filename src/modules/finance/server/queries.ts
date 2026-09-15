import { prisma } from "@/lib/prisma";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from "date-fns";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { CLOSING_SOURCE } from "@/modules/finance/server/shared";
import { computeAverageTicket, computeLaborCostRatio, computeMarginAfterLabor } from "@/modules/finance/compute";
import { computeShiftDurationHours } from "@/modules/planning/compute";
import type { FinanceDailyEntry, FinanceSummary, ServiceReportItem } from "@/modules/finance/types";

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/// Assemble la vue financière à partir des seules données réellement enregistrées
/// (RevenueEntry, CostEntry catégorie "labor", ServiceReport) — aucun chiffre n'est
/// simulé. Les heures planifiées viennent de Shift (Planning) mais sont recalculées ici
/// directement plutôt que d'appeler getWeekPlanning, pour ne pas coupler l'accès aux
/// finances à la permission schedule.view (un rôle peut avoir finance.view sans avoir
/// schedule.view, ou l'inverse).
export async function getFinanceSummary(establishmentId: string, rangeDays = 14): Promise<FinanceSummary> {
  const ctx = await getCurrentContext();
  if (!ctx.can("finance.view")) throw new ForbiddenError("finance.view");

  const rangeStart = startOfDay(subDays(new Date(), rangeDays - 1));
  const rangeEnd = endOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const [revenueEntries, laborCostEntries, reports, weekShifts] = await Promise.all([
    prisma.revenueEntry.findMany({ where: { establishmentId, date: { gte: rangeStart, lte: rangeEnd } } }),
    prisma.costEntry.findMany({
      where: { establishmentId, category: "labor", date: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.serviceReport.findMany({
      where: { establishmentId },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.shift.findMany({
      where: { establishmentId, date: { gte: weekStart, lte: weekEnd }, status: { not: "cancelled" } },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const revenueByDate = new Map<string, { amountCents: number; covers: number }>();
  for (const r of revenueEntries) {
    const key = toDateKey(r.date);
    const entry = revenueByDate.get(key) ?? { amountCents: 0, covers: 0 };
    entry.amountCents += r.amountCents;
    entry.covers += r.covers;
    revenueByDate.set(key, entry);
  }
  const laborByDate = new Map<string, number>();
  for (const c of laborCostEntries) {
    const key = toDateKey(c.date);
    laborByDate.set(key, (laborByDate.get(key) ?? 0) + c.amountCents);
  }

  const dateKeys = [...new Set([...revenueByDate.keys(), ...laborByDate.keys()])].sort();
  const daily: FinanceDailyEntry[] = dateKeys.map((date) => ({
    date,
    revenueCents: revenueByDate.get(date)?.amountCents ?? 0,
    covers: revenueByDate.get(date)?.covers ?? 0,
    laborCostCents: laborByDate.get(date) ?? 0,
  }));

  const totalRevenueCents = daily.reduce((s, d) => s + d.revenueCents, 0);
  const totalCovers = daily.reduce((s, d) => s + d.covers, 0);
  const totalLaborCostCents = daily.reduce((s, d) => s + d.laborCostCents, 0);

  const plannedHoursThisWeek = weekShifts.reduce((s, sh) => s + computeShiftDurationHours(sh.startTime, sh.endTime), 0);

  const recentReports: ServiceReportItem[] = reports.map((r) => ({
    id: r.id,
    date: toDateKey(r.date),
    serviceLabel: r.serviceLabel,
    rating: r.rating,
    covers: r.covers,
    note: r.note,
    issues: r.issues ? r.issues.split(",").filter(Boolean) : [],
  }));

  return {
    rangeDays,
    totalRevenueCents,
    totalCovers,
    totalLaborCostCents,
    averageTicketCents: computeAverageTicket(daily.map((d) => ({ amountCents: d.revenueCents, covers: d.covers }))),
    laborCostRatio: computeLaborCostRatio(totalLaborCostCents, totalRevenueCents),
    marginAfterLaborCents: computeMarginAfterLabor(totalRevenueCents, totalLaborCostCents),
    plannedHoursThisWeek,
    daily,
    recentReports,
  };
}

/// Jours des `lookbackDays` derniers jours (hors aujourd'hui, dont le service n'est pas
/// forcément terminé) sans clôture enregistrée — sert à relancer le manager sans deviner
/// un CA à sa place.
export async function getMissingClosingDates(establishmentId: string, lookbackDays = 14): Promise<string[]> {
  const rangeStart = startOfDay(subDays(new Date(), lookbackDays));
  const rangeEnd = startOfDay(new Date());

  const entries = await prisma.revenueEntry.findMany({
    where: { establishmentId, source: CLOSING_SOURCE, date: { gte: rangeStart, lt: rangeEnd } },
    select: { date: true },
  });
  const closedDates = new Set(entries.map((e) => toDateKey(e.date)));

  const missing: string[] = [];
  for (let i = 1; i <= lookbackDays; i++) {
    const key = toDateKey(subDays(rangeEnd, i));
    if (!closedDates.has(key)) missing.push(key);
  }
  return missing.sort();
}

/// Le CA du jour déjà saisi (le cas échéant), pour pré-remplir le formulaire de clôture
/// plutôt que de laisser le manager repartir de zéro ou créer un doublon.
export async function getTodayClosing(establishmentId: string): Promise<{ revenueCents: number; covers: number } | null> {
  const today = startOfDay(new Date());
  const entry = await prisma.revenueEntry.findFirst({
    where: { establishmentId, source: CLOSING_SOURCE, date: today },
  });
  return entry ? { revenueCents: entry.amountCents, covers: entry.covers } : null;
}
