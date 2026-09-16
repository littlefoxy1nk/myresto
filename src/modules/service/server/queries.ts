import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { timeToMinutes, nowMinutes as computeNowMinutes } from "@/lib/time";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { getFloorPlan } from "@/modules/floorplan/server/queries";
import { computeZonePressureLevel } from "@/modules/workload/compute";
import { resolveActiveService } from "@/modules/service/compute";
import type { ZonePressureLevel } from "@/modules/workload/types";
import type { ServiceAlert, ServiceSnapshot, TimelineEntry } from "@/modules/service/types";

const SOON_THRESHOLD_MINUTES = 45;

/// Assemble la vue "salle de contrôle" du service en cours. Ne recalcule jamais l'état
/// d'une table : getFloorPlan (Mission 1) reste l'unique source de vérité pour libre /
/// réservée / bientôt / occupée / nettoyage / indisponible. Ce module se contente de lire
/// les réservations du jour pour la timeline et de croiser les deux pour détecter les
/// conflits opérationnels (ex: table encore occupée alors qu'une réservation arrive).
/// Un seul appelant (la page /service) : vérification interne pour ne jamais dépendre
/// uniquement d'un futur appelant qui l'aurait oubliée.
export async function getServiceSnapshot(establishmentId: string): Promise<ServiceSnapshot> {
  const ctx = await getCurrentContext();
  if (!ctx.can("service.run")) throw new ForbiddenError("service.run");

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const nowMinutes = computeNowMinutes(now);

  const [zones, services, reservations] = await Promise.all([
    getFloorPlan(establishmentId),
    prisma.serviceDefinition.findMany({ where: { establishmentId } }),
    prisma.reservation.findMany({
      where: { establishmentId, date: { gte: dayStart, lte: dayEnd }, status: { notIn: ["cancelled"] } },
      include: { tables: { include: { table: true } } },
      orderBy: { time: "asc" },
    }),
  ]);

  // --- Service en cours / à venir aujourd'hui — seule fonction du produit qui répond à
  // cette question, voir modules/service/compute.ts.
  const { current: currentService, next: nextService } = resolveActiveService(
    services.map((s) => ({ name: s.name, startTime: s.startTime, endTime: s.endTime, daysOfWeek: s.daysOfWeek.split(",").map(Number) })),
    now
  );

  // --- Timeline ---
  const timeline: TimelineEntry[] = reservations.map((r) => {
    const startMinutes = timeToMinutes(r.time);
    const endMinutes = startMinutes + r.durationMinutes;
    const isPast =
      r.status === "completed" || r.status === "no_show" || (endMinutes <= nowMinutes && r.status !== "arrived" && r.status !== "seated");
    return {
      reservationId: r.id,
      time: r.time,
      customerName: r.customerName,
      partySize: r.partySize,
      tableLabels: r.tables.map((t) => t.table.label),
      status: r.status,
      minutesFromNow: startMinutes - nowMinutes,
      isPast,
    };
  });

  // Limité à un horizon proche : une réservation dans 9h n'a rien d'un "prochain
  // événement" même s'il ne reste rien d'autre à afficher avant — mieux vaut une liste
  // courte, voire vide, qu'une entrée hors sujet qui casse la lecture "ce qui va arriver".
  const NEXT_UP_HORIZON_MINUTES = 180;
  const upcoming = timeline.filter(
    (t) => !t.isPast && (t.status === "new" || t.status === "confirmed") && t.minutesFromNow <= NEXT_UP_HORIZON_MINUTES
  );
  const nextUp = [...upcoming].sort((a, b) => a.minutesFromNow - b.minutesFromNow).slice(0, 3);

  const expectedCovers = timeline.filter((t) => !t.isPast).reduce((s, t) => s + t.partySize, 0);
  const reservationsRemaining = timeline.filter((t) => !t.isPast).length;

  // --- Compteurs de tables (dérivés de la même vérité que le Plan de salle) ---
  const allTables = zones.flatMap((z) => z.tables);
  const tablesOccupied = allTables.filter((t) => t.liveState === "occupied").length;
  const tablesReserved = allTables.filter((t) => t.liveState === "reserved" || t.liveState === "soon").length;
  const tablesToPrep = allTables.filter((t) => t.liveState === "cleaning").length;

  // --- Alertes opérationnelles : uniquement des conflits réels, avec action directe ---
  const reservationsByTableId = new Map<string, typeof reservations>();
  for (const r of reservations) {
    for (const rt of r.tables) {
      const list = reservationsByTableId.get(rt.tableId) ?? [];
      list.push(r);
      reservationsByTableId.set(rt.tableId, list);
    }
  }

  const alerts: ServiceAlert[] = [];
  for (const table of allTables) {
    const tableReservations = reservationsByTableId.get(table.id) ?? [];
    const imminent = tableReservations.find((r) => {
      if (r.status !== "new" && r.status !== "confirmed") return false;
      const minutesFromNow = timeToMinutes(r.time) - nowMinutes;
      return minutesFromNow >= 0 && minutesFromNow <= SOON_THRESHOLD_MINUTES;
    });
    if (!imminent) continue;

    if (table.liveState === "occupied" && table.activeReservation?.id !== imminent.id) {
      alerts.push({
        id: `occupied-${table.id}`,
        kind: "occupied_conflict",
        title: `${table.label} réservée dans ${timeToMinutes(imminent.time) - nowMinutes} min mais toujours occupée`,
        description: `${imminent.customerName} attend cette table à ${imminent.time}.`,
        action: { label: `Libérer ${table.label}`, kind: "release", targetId: table.activeReservation?.id ?? "" },
      });
    } else if (table.manualStatus === "cleaning") {
      alerts.push({
        id: `cleaning-${table.id}`,
        kind: "cleaning_conflict",
        title: `${imminent.customerName} arrive dans ${timeToMinutes(imminent.time) - nowMinutes} min mais ${table.label} est en nettoyage`,
        description: `Réservation de ${imminent.partySize} personnes à ${imminent.time}.`,
        action: { label: "Marquer prête", kind: "mark_ready", targetId: table.id },
      });
    }
  }

  // --- Tension par zone : occupation réelle + arrivées imminentes déjà calculées
  // ci-dessus pour les alertes, jamais un calcul de personnel (voir computeZonePressureLevel).
  const arrivingSoonByZone = new Map<string, number>();
  for (const r of reservations) {
    if (r.status !== "new" && r.status !== "confirmed") continue;
    const minutesFromNow = timeToMinutes(r.time) - nowMinutes;
    if (minutesFromNow < 0 || minutesFromNow > SOON_THRESHOLD_MINUTES) continue;
    const zoneId = r.tables[0]?.table.zoneId;
    if (!zoneId) continue;
    arrivingSoonByZone.set(zoneId, (arrivingSoonByZone.get(zoneId) ?? 0) + 1);
  }

  const zonePressure: Record<string, ZonePressureLevel> = {};
  for (const zone of zones) {
    const occupied = zone.tables.filter((t) => t.liveState === "occupied").length;
    zonePressure[zone.id] = computeZonePressureLevel(occupied, zone.tables.length, arrivingSoonByZone.get(zone.id) ?? 0);
  }

  return {
    now: now.toISOString(),
    hasStarted: !!currentService,
    currentService,
    nextService,
    expectedCovers,
    reservationsRemaining,
    tablesOccupied,
    tablesReserved,
    tablesToPrep,
    totalTables: allTables.length,
    alerts,
    nextUp,
    timeline,
    zones,
    zonePressure,
  };
}
