import { timeToMinutes } from "@/lib/time";

/// Le nom d'un service n'est plus saisi : il est calculé à partir de ses horaires (voir lib/service-label.ts).
export type ServiceInput = { name?: string; startTime: string; endTime: string; days: number[] };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/// Vérifie un service saisi et renvoie un message clair, ou null s'il est valide.
/// `others` = les autres services de l'établissement : deux services ne se chevauchent pas
/// un même jour (ils peuvent se toucher : 18:00–20:30 puis 20:30–23:00).
export function validateService(
  input: ServiceInput,
  others: (ServiceInput & { id: string; name: string })[],
  selfId?: string
): string | null {
  if (!HHMM.test(input.startTime) || !HHMM.test(input.endTime)) return "Les heures doivent être au format HH:MM.";
  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  if (end <= start) return "La fin du service doit être après son début.";
  if (input.days.length === 0 || input.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
    return "Choisis au moins un jour.";
  }

  for (const other of others) {
    if (other.id === selfId) continue;
    if (!other.days.some((d) => input.days.includes(d))) continue;
    if (start < timeToMinutes(other.endTime) && end > timeToMinutes(other.startTime)) {
      return `Ce service chevauche « ${other.name} » (${other.startTime}–${other.endTime}).`;
    }
  }
  return null;
}
