import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, format } from "date-fns";
import { computeWorkloadSummary } from "@/modules/workload/compute";
import { computeFrequentationSignal, detectLargeGroups, detectNotableConcentration } from "@/modules/frequentation/compute";
import { getHistoricalCoversByWeekday } from "@/modules/frequentation/server/queries";
import { resolveActiveService } from "@/modules/service/compute";
import { timeToMinutes, nowMinutes } from "@/lib/time";

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

/// Le service actif est déterminé une seule fois pour tout le produit — voir
/// modules/service/compute.ts. "none" doit être affiché tel quel, jamais remplacé par
/// une déduction depuis une réservation.
export type TodayActiveService =
  | { status: "current"; name: string; startTime: string; endTime: string }
  | { status: "upcoming"; name: string; startTime: string; endTime: string; minutesFromNow: number }
  | { status: "none" };

export type TodayOccupancy = { serviceName: string; rate: number };

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
  activeService: TodayActiveService;
  /// null si aucun service (en cours ou à venir) ne permet de rattacher les couverts à
  /// une capacité comparable — jamais un pourcentage qui mélangerait plusieurs services.
  occupancy: TodayOccupancy | null;
  alerts: TodayAlert[];
  /// La prochaine chose qui va se passer dans l'établissement — ce qui doit occuper le
  /// haut du regard du patron avant les KPI agrégés. null s'il n'y a plus rien à venir.
  nextUp: UpcomingReservation | null;
};

/// Calcule, à partir des données réelles de l'établissement (réservations, planning,
/// congés, historique de fréquentation), ce qu'un patron doit savoir aujourd'hui.
/// Pas de LLM ici, des règles explicites et vérifiables. Important : ce module ne
/// contient et ne doit jamais contenir de déduction du type "couverts / ratio = nombre
/// de serveurs nécessaires" — voir la Fréquentation (module frequentation), qui donne un
/// signal, jamais une décision de personnel.
export async function computeTodaySummary(establishmentId: string): Promise<TodaySummary> {
  const today = startOfDay(new Date());
  const dayStart = today;
  const dayEnd = endOfDay(today);

  const [reservations, shifts, timeOffToday, tables, services, historicalCoversByWeekday] = await Promise.all([
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
        membership: { status: "active" },
      },
      include: { membership: { include: { user: true } } },
    }),
    prisma.restaurantTable.findMany({ where: { establishmentId } }),
    prisma.serviceDefinition.findMany({ where: { establishmentId } }),
    getHistoricalCoversByWeekday(establishmentId, today),
  ]);

  const covers = reservations.reduce((sum, r) => sum + r.partySize, 0);
  const confirmedCount = reservations.filter((r) => r.status === "confirmed" || r.status === "arrived" || r.status === "seated").length;
  const unconfirmedCount = reservations.filter((r) => r.status === "new").length;
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);

  // Service actif — même fonction que Mode Service, jamais déduit d'une réservation.
  // `today` est normalisé à minuit (pour les bornes de requête) : il faut l'heure réelle
  // pour savoir quel service est en cours maintenant.
  const { current, next } = resolveActiveService(
    services.map((s) => ({ name: s.name, startTime: s.startTime, endTime: s.endTime, daysOfWeek: s.daysOfWeek.split(",").map(Number) })),
    new Date()
  );
  const activeService: TodayActiveService = current
    ? { status: "current", ...current }
    : next
      ? { status: "upcoming", ...next }
      : { status: "none" };

  // Occupation : uniquement comparable au service actif (ou, à défaut, au prochain) —
  // jamais un cumul de plusieurs services contre une capacité statique unique, qui
  // donnerait un pourcentage sans rapport avec un état réel de la salle.
  const relevantServiceDef = current
    ? services.find((s) => s.name === current.name && s.startTime === current.startTime)
    : next
      ? services.find((s) => s.name === next.name && s.startTime === next.startTime)
      : undefined;
  const occupancy: TodayOccupancy | null =
    relevantServiceDef && totalCapacity > 0
      ? {
          serviceName: relevantServiceDef.name,
          rate: Math.min(1, reservations.filter((r) => r.serviceId === relevantServiceDef.id).reduce((s, r) => s + r.partySize, 0) / totalCapacity),
        }
      : null;

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

  // Demandes de réservation en ligne en attente (tous jours à venir) : le client attend une réponse.
  const pendingOnline = await prisma.reservation.findMany({
    where: { establishmentId, source: "online", status: "new", date: { gte: startOfDay(today) } },
    select: { date: true },
    orderBy: { date: "asc" },
  });
  if (pendingOnline.length > 0) {
    const n = pendingOnline.length;
    alerts.push({
      id: "online-requests",
      severity: "important",
      title: `${n} demande${n > 1 ? "s" : ""} de réservation en ligne à traiter`,
      description: "Choisis une table puis confirme : le client attend ta réponse.",
      action: { label: "Voir les demandes", href: `/reservations?date=${format(pendingOnline[0].date, "yyyy-MM-dd")}` },
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
  const currentMinutes = nowMinutes();
  const upcoming = reservations
    .filter((r) => r.status === "new" || r.status === "confirmed")
    .map((r) => ({ reservation: r, minutesFromNow: timeToMinutes(r.time) - currentMinutes }))
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
    activeService,
    occupancy,
    alerts,
    nextUp,
  };
}
