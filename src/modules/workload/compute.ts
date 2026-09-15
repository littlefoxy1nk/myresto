import type { ArrivalWindow, WorkloadReservation, WorkloadSummary, WorkloadZoneInput, ZonePressureLevel, ZoneWorkload } from "./types";

const UNASSIGNED_ZONE_ID = "__unassigned__";

/// Fonction métier pure : aucun accès base de données, aucune notion de "maintenant" —
/// on lui donne des réservations déjà résolues (zone connue) et l'état des zones, elle
/// rend un résumé de charge. C'est le seul endroit où ce calcul existe dans le produit ;
/// Today, Mode Service, le futur Planning, les Insights et l'IA sont censés l'appeler,
/// jamais le réécrire à leur façon.
export function computeWorkloadSummary(
  reservations: WorkloadReservation[],
  zones: WorkloadZoneInput[],
  intervalMinutes = 30
): WorkloadSummary {
  const totalCovers = reservations.reduce((s, r) => s + r.partySize, 0);
  const totalTables = zones.reduce((s, z) => s + z.tablesCount, 0);

  const byZone: ZoneWorkload[] = zones.map((zone) => {
    const zoneReservations = reservations.filter((r) => r.zoneId === zone.id);
    const covers = zoneReservations.reduce((s, r) => s + r.partySize, 0);
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      covers,
      reservationsCount: zoneReservations.length,
      tablesCount: zone.tablesCount,
      assignedStaffCount: zone.assignedStaffCount,
      coversPerStaff: zone.assignedStaffCount > 0 ? Math.round((covers / zone.assignedStaffCount) * 10) / 10 : null,
    };
  });

  const unassigned = reservations.filter((r) => !r.zoneId);
  if (unassigned.length > 0) {
    byZone.push({
      zoneId: UNASSIGNED_ZONE_ID,
      zoneName: "Sans table assignée",
      covers: unassigned.reduce((s, r) => s + r.partySize, 0),
      reservationsCount: unassigned.length,
      tablesCount: 0,
      assignedStaffCount: 0,
      coversPerStaff: null,
    });
  }

  const windowMap = new Map<number, { covers: number; count: number }>();
  for (const r of reservations) {
    const [h, m] = r.time.split(":").map(Number);
    const totalMinutes = h * 60 + m;
    const bucketStart = Math.floor(totalMinutes / intervalMinutes) * intervalMinutes;
    const entry = windowMap.get(bucketStart) ?? { covers: 0, count: 0 };
    entry.covers += r.partySize;
    entry.count += 1;
    windowMap.set(bucketStart, entry);
  }

  const arrivalConcentration: ArrivalWindow[] = [...windowMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, entry]) => ({
      startTime: `${String(Math.floor(bucketStart / 60)).padStart(2, "0")}:${String(bucketStart % 60).padStart(2, "0")}`,
      covers: entry.covers,
      reservationsCount: entry.count,
    }));

  return {
    totalCovers,
    totalReservations: reservations.length,
    totalTables,
    byZone,
    arrivalConcentration,
  };
}

// Occupation physique réelle de la zone (tables occupées / tables totales) croisée avec
// les arrivées imminentes déjà connues — jamais une notion de personnel. "Pleine" est un
// fait (plus une seule table libre) ; "chargée" reste un signal simple, pas une alerte.
const CHARGEE_OCCUPANCY_RATIO = 0.5;

export function computeZonePressureLevel(tablesOccupied: number, tablesTotal: number, arrivingSoon: number): ZonePressureLevel {
  if (tablesTotal === 0) return "calme";
  if (tablesOccupied >= tablesTotal) return "pleine";
  if (arrivingSoon > 0 && tablesOccupied / tablesTotal >= CHARGEE_OCCUPANCY_RATIO) return "chargee";
  return "calme";
}
