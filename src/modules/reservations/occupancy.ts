import { startOfDay } from "date-fns";
import { nowMinutes } from "@/lib/time";

/// Un repas terminé (client libéré) ne retient plus sa table pour un créneau qui commence maintenant ou plus tard :
/// la table est vide, on peut y réinstaller quelqu'un ou la réserver pour tout à l'heure. Pour un créneau déjà passé,
/// la réservation terminée reste comptée (on ne réécrit pas l'historique de la journée).
export function completedStillBlocks(date: Date, startMinutes: number, now: Date = new Date()): boolean {
  const today = startOfDay(now).getTime();
  const day = startOfDay(date).getTime();
  if (day < today) return true;
  if (day > today) return false;
  return startMinutes < nowMinutes(now);
}

/// Statuts qui ne retiennent PAS la table pour ce créneau (toujours annulée / absente ; terminée selon la règle ci-dessus).
export function nonBlockingStatuses(date: Date, startMinutes: number, now: Date = new Date()): string[] {
  return completedStillBlocks(date, startMinutes, now) ? ["cancelled", "no_show"] : ["cancelled", "no_show", "completed"];
}
