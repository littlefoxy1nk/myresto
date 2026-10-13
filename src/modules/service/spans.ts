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

/// Durée réellement bloquée : la durée normale, ou — si le responsable a coché "bloquer
/// aussi le service suivant" — jusqu'à la fin de ce service, si c'est plus long. Ainsi la
/// table apparaît occupée sur les deux services avec la logique de chevauchement habituelle.
export function effectiveDuration(
  baseMinutes: number,
  time: string,
  spansNextService: boolean,
  services: ServiceWindow[]
): number {
  if (!spansNextService) return baseMinutes;
  const next = nextServiceAfter(services, time);
  if (!next) return baseMinutes;
  return Math.max(baseMinutes, timeToMinutes(next.endTime) - timeToMinutes(time));
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
