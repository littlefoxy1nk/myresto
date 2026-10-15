import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { isoWeekday } from "@/lib/time";
import { coversPerService } from "@/modules/service/spans";
import {
  formatServiceRanges,
  resolveServiceGroup,
  teamByDepartment,
  type DepartmentLine,
} from "@/modules/today/summary";

export type TodayOverview = {
  /// null s'il ne reste plus de service aujourd'hui.
  service: {
    status: "current" | "upcoming";
    /// « de 18h à 20h30 et de 20h30 à 22h » (les services qui restent à faire).
    label: string;
    /// Combien de services restent à faire (pour « Prochain service » / « Prochains services »).
    remaining: number;
    window: { start: string; end: string };
  } | null;
  /// null si la personne n'a pas le droit de voir les réservations. Le total, et le détail par service de la période
  /// (chaque réservation comptée une seule fois, dans le service qui contient son heure de début).
  covers: { total: number; perService: { label: string; covers: number }[] } | null;
  team: DepartmentLine[];
};

/// Le résumé du jour : le (ou les) service(s) à venir ou en cours — les deux du soir ensemble —, les couverts
/// réservés sur toute la période et l'équipe prévue. Tout vient des réservations et des horaires publiés.
export async function getTodayOverview(establishmentId: string): Promise<TodayOverview> {
  const ctx = await getCurrentContext();
  const now = new Date();

  const services = await prisma.serviceDefinition.findMany({ where: { establishmentId } });
  const group = resolveServiceGroup(
    services.map((s) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime, daysOfWeek: s.daysOfWeek.split(",").map(Number) })),
    now
  );
  if (!group) return { service: null, covers: null, team: [] };

  const [reservations, shifts] = await Promise.all([
    ctx.can("reservations.view")
      ? prisma.reservation.findMany({
          where: { establishmentId, date: { gte: startOfDay(now), lte: endOfDay(now) } },
          select: { time: true, partySize: true, status: true },
        })
      : Promise.resolve(null),
    prisma.shift.findMany({
      where: {
        establishmentId,
        date: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { in: ["published", "confirmed", "completed"] },
      },
      include: { membership: { include: { user: { select: { firstName: true } } } } },
    }),
  ]);

  // L'attribution se fait parmi TOUS les services du jour (une réservation de midi ne doit pas aller au soir) ;
  // on ne garde ensuite que ceux de la période dont on parle.
  const todayWindows = services
    .filter((s) => s.daysOfWeek.split(",").map(Number).includes(isoWeekday(now)))
    .map((s) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime }));
  const periodIds = new Set(group.periodServices.map((s) => s.id));
  const perService = reservations
    ? coversPerService(todayWindows, reservations)
        .filter((row) => periodIds.has(row.service.id))
        .map((row) => ({ label: row.service.name, covers: row.covers }))
    : null;

  return {
    service: {
      status: group.status,
      label: formatServiceRanges(group.services),
      remaining: group.services.length,
      window: group.window,
    },
    covers: perService ? { total: perService.reduce((sum, row) => sum + row.covers, 0), perService } : null,
    team: teamByDepartment(
      shifts.map((s) => ({ firstName: s.membership.user.firstName, position: s.position, startTime: s.startTime, endTime: s.endTime })),
      group.window
    ),
  };
}

export type CountdownEventItem = { id: string; title: string; date: string };

export async function getCountdownEvents(establishmentId: string): Promise<CountdownEventItem[]> {
  const events = await prisma.countdownEvent.findMany({ where: { establishmentId }, orderBy: { date: "asc" } });
  return events.map((e) => ({ id: e.id, title: e.title, date: toDateKey(e.date) }));
}
