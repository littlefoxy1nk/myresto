import type { ZoneWithTables } from "@/modules/floorplan/types";

const REAL_TIME_STATES = new Set(["occupied", "cleaning", "unavailable"]);

/// Avant le début d'un service, le plan montre les réservations de sa plage ; mais une table déjà occupée
/// maintenant (un client installé sans réservation, un repas qui se termine), à nettoyer ou indisponible doit
/// le montrer aussi. On reprend donc l'état RÉEL du moment pour ces tables-là, et on garde le reste du plan du service.
export function overlayRealTimeStates(windowZones: ZoneWithTables[], liveZones: ZoneWithTables[]): ZoneWithTables[] {
  const liveById = new Map(liveZones.flatMap((z) => z.tables).map((t) => [t.id, t]));
  return windowZones.map((zone) => ({
    ...zone,
    tables: zone.tables.map((table) => {
      const live = liveById.get(table.id);
      if (!live || !REAL_TIME_STATES.has(live.liveState)) return table;
      return { ...table, liveState: live.liveState, activeReservation: live.activeReservation };
    }),
  }));
}
