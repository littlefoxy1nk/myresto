import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { isoWeekday } from "@/lib/time";
import { toDateKey } from "@/lib/utils";
import { buildPaperSheets, type PaperSheet } from "@/modules/floorplan/paper-plan";

/// Les clés yyyy-MM-dd de chaque jour de `from` à `to` (inclus), midi pour ne jamais sauter ni doubler un jour au changement d'heure.
export function dayKeysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cursor <= end) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/// Les feuilles papier de plusieurs jours, pour toutes les salles ou une seule. Permission-agnostique : l'appelant vérifie floorplan.view.
export async function getPaperPlanSheets(
  establishmentId: string,
  params: { from: string; to: string; zoneId: string | null }
): Promise<PaperSheet[]> {
  const days = dayKeysBetween(params.from, params.to);
  if (days.length === 0) return [];

  const [zones, services, reservations] = await Promise.all([
    prisma.zone.findMany({
      where: { establishmentId, ...(params.zoneId ? { id: params.zoneId } : {}) },
      include: { tables: { select: { id: true, label: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.serviceDefinition.findMany({ where: { establishmentId }, orderBy: { startTime: "asc" } }),
    prisma.reservation.findMany({
      where: {
        establishmentId,
        date: { gte: startOfDay(new Date(`${params.from}T12:00:00`)), lte: endOfDay(new Date(`${params.to}T12:00:00`)) },
        status: { notIn: ["cancelled", "no_show"] },
      },
      include: { tables: { select: { tableId: true } } },
    }),
  ]);

  const sheets: PaperSheet[] = [];
  for (const dateKey of days) {
    const weekday = isoWeekday(new Date(`${dateKey}T12:00:00`));
    sheets.push(
      ...buildPaperSheets({
        dateKey,
        zones,
        services: services
          .filter((s) => s.daysOfWeek.split(",").map(Number).includes(weekday))
          .map((s) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime })),
        reservations: reservations
          .filter((r) => toDateKey(r.date) === dateKey)
          .map((r) => ({ customerName: r.customerName, customerPhone: r.customerPhone, partySize: r.partySize, time: r.time, tableIds: r.tables.map((t) => t.tableId) })),
        // Les réservations sans table n'appartiennent à aucune salle : on les met sur le papier seulement quand on imprime tout.
        includeUnassigned: params.zoneId === null,
      })
    );
  }
  return sheets;
}
