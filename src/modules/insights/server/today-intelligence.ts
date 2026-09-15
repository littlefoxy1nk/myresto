import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { computeDaysLeft } from "@/modules/stock/compute";
import { computeWorkloadSummary } from "@/modules/workload/compute";
import { computeFrequentationSignal, detectLargeGroups, detectNotableConcentration } from "@/modules/frequentation/compute";
import { getHistoricalCoversByWeekday } from "@/modules/frequentation/server/queries";

export type AlertSeverity = "urgent" | "important" | "watch";

export type TodayAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  description?: string;
  /// Quand une action existe réellement pour résoudre l'alerte, elle est portée ici —
  /// jamais vers un module qui n'est pas encore construit (voir NAV_ITEMS.available).
  action?: { label: string; href: string };
};

export type UpcomingReservation = {
  id: string;
  time: string;
  minutesFromNow: number;
  partySize: number;
  customerName: string;
  tableLabels: string[];
  status: string;
};

export type TodaySummary = {
  date: Date;
  reservationsCount: number;
  covers: number;
  confirmedCount: number;
  unconfirmedCount: number;
  staffOnShift: number;
  serviceLabel: string | null;
  occupancyRate: number; // couverts prévus / capacité totale de la salle
  alerts: TodayAlert[];
  /// La prochaine chose qui va se passer dans l'établissement — ce qui doit occuper le
  /// haut du regard du patron avant les KPI agrégés. null s'il n'y a plus rien à venir.
  nextUp: UpcomingReservation | null;
};

/// Calcule, à partir des données réelles de l'établissement (réservations, planning,
/// congés, stock, historique de fréquentation), ce qu'un patron doit savoir aujourd'hui.
/// Pas de LLM ici, des règles explicites et vérifiables. Important : ce module ne
/// contient et ne doit jamais contenir de déduction du type "couverts / ratio = nombre
/// de serveurs nécessaires" — voir la Fréquentation (module frequentation), qui donne un
/// signal, jamais une décision de personnel.
export async function computeTodaySummary(establishmentId: string): Promise<TodaySummary> {
  const today = startOfDay(new Date());
  const dayStart = today;
  const dayEnd = endOfDay(today);

  const [reservations, shifts, timeOffToday, tables, products, historicalCoversByWeekday] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        establishmentId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["cancelled"] },
      },
      include: { service: true, tables: { include: { table: true } } },
    }),
    prisma.shift.findMany({
      where: { establishmentId, date: { gte: dayStart, lte: dayEnd }, status: { not: "cancelled" } },
    }),
    prisma.timeOffRequest.findMany({
      where: {
        establishmentId,
        status: "approved",
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
      include: { membership: { include: { user: true } } },
    }),
    prisma.restaurantTable.findMany({ where: { establishmentId } }),
    prisma.product.findMany({ where: { establishmentId } }),
    getHistoricalCoversByWeekday(establishmentId, today),
  ]);

  const covers = reservations.reduce((sum, r) => sum + r.partySize, 0);
  const confirmedCount = reservations.filter((r) => r.status === "confirmed" || r.status === "arrived" || r.status === "seated").length;
  const unconfirmedCount = reservations.filter((r) => r.status === "new").length;
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const occupancyRate = totalCapacity > 0 ? Math.min(1, covers / totalCapacity) : 0;
  const serviceLabel = reservations[0]?.service?.name ?? (shifts[0] ? "Service" : null);

  const alerts: TodayAlert[] = [];

  // Absence du jour — un fait, indépendant de toute notion de couverture suffisante ou non.
  for (const t of timeOffToday) {
    alerts.push({
      id: `absence-${t.id}`,
      severity: "urgent",
      title: `${t.membership.user.firstName} ${t.membership.user.lastName} est absent(e) aujourd'hui`,
      description: t.membership.jobTitle ?? undefined,
    });
  }

  // Réservations non confirmées
  if (unconfirmedCount > 0) {
    alerts.push({
      id: "unconfirmed-reservations",
      severity: "important",
      title: `${unconfirmedCount} réservation${unconfirmedCount > 1 ? "s" : ""} non confirmée${unconfirmedCount > 1 ? "s" : ""}`,
      description: "Pensez à les confirmer avant le service.",
      action: { label: "Voir les réservations", href: "/reservations" },
    });
  }

  // Stock critique : rupture avant le prochain réassort estimé
  for (const p of products) {
    const daysLeft = computeDaysLeft(p.currentStock, p.avgDailyUsage);
    if (daysLeft != null && p.currentStock <= p.reorderThreshold) {
      alerts.push({
        id: `stock-${p.id}`,
        severity: daysLeft <= 1 ? "urgent" : "watch",
        title: `Stock faible : ${p.name}`,
        description: `Il reste environ ${daysLeft} jour${daysLeft > 1 ? "s" : ""} de stock au rythme actuel.`,
      });
    }
  }

  // Fréquentation : un signal sur la demande, jamais une déduction de personnel. On ne
  // signale que les jours réellement inhabituels (faible/élevée) — une journée "normale"
  // ou sans historique suffisant ne mérite pas une ligne dans "à faire".
  const frequentation = computeFrequentationSignal(covers, historicalCoversByWeekday[today.getDay()]);
  if (frequentation.level === "elevee" || frequentation.level === "faible") {
    const dayName = new Intl.DateTimeFormat("fr-BE", { weekday: "long" }).format(today);
    alerts.push({
      id: "frequentation-signal",
      severity: frequentation.level === "elevee" ? "important" : "watch",
      title: frequentation.level === "elevee" ? "Fréquentation inhabituelle" : "Journée calme",
      description: `${covers} couvert${covers > 1 ? "s" : ""} attendu${covers > 1 ? "s" : ""} contre ${frequentation.historicalAverageCovers} habituellement le ${dayName}.`,
    });
  }

  // Concentration d'arrivées notable — un fait sur la répartition dans le temps, pas
  // sur le personnel nécessaire pour l'absorber.
  const workloadSummary = computeWorkloadSummary(
    reservations.map((r) => ({ time: r.time, partySize: r.partySize, zoneId: null })),
    []
  );
  const concentration = detectNotableConcentration(workloadSummary.arrivalConcentration, covers);
  if (concentration) {
    alerts.push({
      id: "arrival-concentration",
      severity: "watch",
      title: "Concentration d'arrivées",
      description: `${concentration.reservationsCount} réservations (${concentration.covers} couverts) concentrées autour de ${concentration.startTime}.`,
    });
  }

  // Gros groupes — un fait physique (la réservation dépasse la plus grande table
  // disponible), jamais un seuil de personnel.
  const maxSingleTableCapacity = tables.reduce((max, t) => Math.max(max, t.capacity), 0);
  const largeGroups = detectLargeGroups(reservations, maxSingleTableCapacity);
  for (const g of largeGroups) {
    alerts.push({
      id: `large-group-${g.reservationId}`,
      severity: "watch",
      title: "Groupe important",
      description: `${g.customerName} · ${g.partySize} personnes à ${g.time} — dépasse la plus grande table disponible (${maxSingleTableCapacity} places).`,
    });
  }

  const severityRank: Record<AlertSeverity, number> = { urgent: 0, important: 1, watch: 2 };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  // Prochaine échéance : la réservation à venir la plus proche qui n'est pas encore
  // arrivée. On compare des chaînes "HH:MM" au temps courant, tout se joue sur la
  // journée en cours donc c'est suffisant et lisible sans manipuler de fuseaux.
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = reservations
    .filter((r) => r.status === "new" || r.status === "confirmed")
    .map((r) => {
      const [h, m] = r.time.split(":").map(Number);
      return { reservation: r, minutesFromNow: h * 60 + m - nowMinutes };
    })
    .filter((r) => r.minutesFromNow >= -15) // encore pertinent même un peu en retard
    .sort((a, b) => a.minutesFromNow - b.minutesFromNow)[0];

  const nextUp: UpcomingReservation | null = upcoming
    ? {
        id: upcoming.reservation.id,
        time: upcoming.reservation.time,
        minutesFromNow: upcoming.minutesFromNow,
        partySize: upcoming.reservation.partySize,
        customerName: upcoming.reservation.customerName,
        tableLabels: upcoming.reservation.tables.map((t) => t.table.label),
        status: upcoming.reservation.status,
      }
    : null;

  return {
    date: today,
    reservationsCount: reservations.length,
    covers,
    confirmedCount,
    unconfirmedCount,
    staffOnShift: shifts.length,
    serviceLabel,
    occupancyRate,
    alerts,
    nextUp,
  };
}
