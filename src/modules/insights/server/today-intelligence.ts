import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

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

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
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
  recommendations: Recommendation[];
  /// La prochaine chose qui va se passer dans l'établissement — ce qui doit occuper le
  /// haut du regard du patron avant les KPI agrégés. null s'il n'y a plus rien à venir.
  nextUp: UpcomingReservation | null;
};

/// Calcule, à partir des données réelles de l'établissement (réservations, planning,
/// congés, stock), ce qu'un patron doit savoir et faire aujourd'hui. C'est le cœur de
/// l'intelligence contextuelle décrite dans la vision produit : pas de LLM ici, des règles
/// explicites et vérifiables — la V2 pourra les enrichir ou les reformuler via l'assistant IA,
/// mais le calcul de vérité reste toujours ancré dans les données réelles.
export async function computeTodaySummary(establishmentId: string): Promise<TodaySummary> {
  const today = startOfDay(new Date());
  const dayStart = today;
  const dayEnd = endOfDay(today);

  const [reservations, shifts, timeOffToday, tables, products] = await Promise.all([
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
  ]);

  const covers = reservations.reduce((sum, r) => sum + r.partySize, 0);
  const confirmedCount = reservations.filter((r) => r.status === "confirmed" || r.status === "arrived" || r.status === "seated").length;
  const unconfirmedCount = reservations.filter((r) => r.status === "new").length;
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const occupancyRate = totalCapacity > 0 ? Math.min(1, covers / totalCapacity) : 0;
  const serviceLabel = reservations[0]?.service?.name ?? (shifts[0] ? "Service" : null);

  const alerts: TodayAlert[] = [];

  // Absence du jour — le fait est toujours urgent à connaître ; c'est l'alerte de
  // staffing plus bas (comparaison couverts / serveurs planifiés) qui dit si ça pose
  // réellement un problème de couverture, pas une heuristique déconnectée ici.
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
    if (p.avgDailyUsage > 0 && p.currentStock <= p.reorderThreshold) {
      const daysLeft = Math.floor(p.currentStock / p.avgDailyUsage);
      alerts.push({
        id: `stock-${p.id}`,
        severity: daysLeft <= 1 ? "urgent" : "watch",
        title: `Stock faible : ${p.name}`,
        description: `Il reste environ ${daysLeft} jour${daysLeft > 1 ? "s" : ""} de stock au rythme actuel.`,
      });
    }
  }

  // Staffing en salle vs couverts prévus (règle simple : ~1 serveur pour 20 couverts)
  const floorStaffCount = shifts.filter((s) => s.position === "salle").length;
  const recommendedFloorStaff = Math.ceil(covers / 20);
  const recommendations: Recommendation[] = [];
  if (covers > 0 && recommendedFloorStaff > floorStaffCount) {
    const missing = recommendedFloorStaff - floorStaffCount;
    alerts.push({
      id: "understaffed-floor",
      severity: "important",
      title: `Salle potentiellement sous-staffée`,
      description: `${covers} couverts prévus pour ${floorStaffCount} serveur${floorStaffCount > 1 ? "s" : ""} en salle.`,
    });
    recommendations.push({
      id: "add-floor-staff",
      title: `Ajouter ${missing} serveur${missing > 1 ? "s" : ""} pour ce service`,
      description: `Avec ${covers} couverts prévus, la couverture recommandée est d'environ ${recommendedFloorStaff} serveurs en salle. Le planning actuel en compte ${floorStaffCount}.`,
      // Le planning n'a pas encore d'interface (Phase 2) : on renvoie vers l'équipe,
      // seul écran réel qui permet aujourd'hui de voir qui est disponible.
      actionLabel: "Voir l'équipe",
      actionHref: "/equipe",
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
    recommendations,
    nextUp,
  };
}
