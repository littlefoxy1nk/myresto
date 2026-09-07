"use server";

import { requirePermission } from "@/lib/current-context";
import { getFloorPlanForSlot } from "@/modules/floorplan/server/queries";
import { suggestTablesForParty, type TableSuggestion } from "@/modules/floorplan/server/suggestions";
import type { ZoneWithTables } from "@/modules/floorplan/types";

export type ReservationPlanningResult = {
  zones: ZoneWithTables[];
  suggestions: TableSuggestion[];
};

/// Assemble ce dont l'écran de création de réservation a besoin pour un créneau donné :
/// l'état de chaque table à cette heure précise (pas "maintenant") et les suggestions du
/// moteur existant (floorplan/server/suggestions.ts, inchangé). Aucune deuxième logique de
/// scoring ici — cette fonction ne fait que préparer les données dans la forme attendue.
export async function getReservationPlanningData(input: {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  durationMinutes: number;
  partySize: number;
  excludeReservationId?: string;
}): Promise<ReservationPlanningResult> {
  const ctx = await requirePermission("reservations.edit");

  const date = new Date(`${input.date}T00:00:00`);
  const zones = await getFloorPlanForSlot(
    ctx.establishment.id,
    date,
    input.time,
    input.durationMinutes,
    input.excludeReservationId
  );

  const allTables = zones.flatMap((z) => z.tables);
  const suggestions = suggestTablesForParty(allTables, input.partySize);

  return { zones, suggestions };
}
