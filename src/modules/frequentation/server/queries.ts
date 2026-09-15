import { prisma } from "@/lib/prisma";
import { startOfDay, subWeeks } from "date-fns";

/// Couverts réellement enregistrés (RevenueEntry), groupés par jour de semaine (0=dim.
/// ... 6=sam., convention native JS Date), sur les `lookbackWeeks` précédant
/// `beforeDate` — la seule source honnête pour juger si un jour est "habituel". Une
/// seule requête, réutilisable pour toute une semaine de planning ou un seul jour.
export async function getHistoricalCoversByWeekday(
  establishmentId: string,
  beforeDate: Date,
  lookbackWeeks = 12
): Promise<number[][]> {
  const rangeStart = subWeeks(startOfDay(beforeDate), lookbackWeeks);

  const entries = await prisma.revenueEntry.findMany({
    where: { establishmentId, date: { gte: rangeStart, lt: startOfDay(beforeDate) } },
    select: { date: true, covers: true },
  });

  const byWeekday: number[][] = Array.from({ length: 7 }, () => []);
  for (const e of entries) byWeekday[e.date.getDay()].push(e.covers);
  return byWeekday;
}
