import { timeToMinutes } from "@/lib/time";

/// Un service du jour (ex: "18h" 18:00–20:30). Les restaurants à plusieurs services par
/// soir (12h / 18h / 20h30) les définissent dans Paramètres.
export type ServiceWindow = { id: string; name: string; startTime: string; endTime: string };

/// Le service dans lequel tombe l'heure demandée (début inclus, fin exclue), s'il y en a un.
export function serviceAt(services: ServiceWindow[], time: string): ServiceWindow | null {
  const t = timeToMinutes(time);
  return sorted(services).find((s) => timeToMinutes(s.startTime) <= t && t < timeToMinutes(s.endTime)) ?? null;
}

/// Le service qui suit l'heure demandée : celui d'après le service en cours, ou à défaut le
/// premier qui commence plus tard. C'est lui que la case "bloquer aussi le service suivant"
/// ajoute à la réservation.
export function nextServiceAfter(services: ServiceWindow[], time: string): ServiceWindow | null {
  const t = timeToMinutes(time);
  const current = serviceAt(services, time);
  const from = current ? timeToMinutes(current.endTime) : t + 1;
  return sorted(services).find((s) => timeToMinutes(s.startTime) >= from && s.id !== current?.id) ?? null;
}

/// À partir de cette heure, une réservation est "du soir" : elle peut bloquer sa table
/// jusqu'à la fermeture.
export const EVENING_START_MINUTES = 17 * 60;

/// Fin de la soirée = fin du dernier service du jour, pour une réservation du soir. Null si la
/// réservation n'est pas du soir ou s'il n'y a rien après son heure.
export function eveningEnd(services: ServiceWindow[], time: string): string | null {
  const t = timeToMinutes(time);
  if (t < EVENING_START_MINUTES || services.length === 0) return null;
  const last = sorted(services)[services.length - 1];
  return timeToMinutes(last.endTime) > t ? last.endTime : null;
}

/// Durée réellement bloquée : la durée normale, étendue — si le responsable l'a demandé — jusqu'à
/// la fin du service suivant ("bloquer aussi le service suivant") ou jusqu'à la fermeture
/// ("bloquer toute la soirée"), si c'est plus long. La table apparaît alors occupée sur tous les
/// services concernés avec la logique de chevauchement habituelle.
export function effectiveDuration(
  baseMinutes: number,
  time: string,
  spansNextService: boolean,
  services: ServiceWindow[],
  blocksEvening = false
): number {
  const start = timeToMinutes(time);
  let duration = baseMinutes;
  if (spansNextService) {
    const next = nextServiceAfter(services, time);
    if (next) duration = Math.max(duration, timeToMinutes(next.endTime) - start);
  }
  if (blocksEvening) {
    const end = eveningEnd(services, time);
    if (end) duration = Math.max(duration, timeToMinutes(end) - start);
  }
  return duration;
}

function sorted(services: ServiceWindow[]) {
  return [...services].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/// La réservation occupe-t-elle une partie de ce service ? Même règle de chevauchement que
/// partout ailleurs (début < fin du service et fin > début du service) — c'est ce qui fait
/// apparaître une réservation "qui bloque les 2 services" sur les deux.
export function overlapsService(
  reservation: { time: string; durationMinutes: number },
  service: ServiceWindow
): boolean {
  const start = timeToMinutes(reservation.time);
  const end = start + reservation.durationMinutes;
  return start < timeToMinutes(service.endTime) && end > timeToMinutes(service.startTime);
}
