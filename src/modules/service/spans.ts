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

/// Le service auquel appartient une réservation : celui qui CONTIENT son heure de début (début inclus, fin exclue),
/// sans que personne ait à le choisir — 21h tombe dans « 20h30 à 22h ». Si l'heure est hors de tout service
/// (entre deux services, après la fermeture), le plus proche l'emporte.
export function assignService(services: ServiceWindow[], time: string): ServiceWindow | null {
  const contained = serviceAt(services, time);
  if (contained) return contained;
  if (services.length === 0) return null;
  const t = timeToMinutes(time);
  const distance = (s: ServiceWindow) => {
    const start = timeToMinutes(s.startTime);
    const end = timeToMinutes(s.endTime);
    return t < start ? start - t : t - end;
  };
  return sorted(services).reduce((best, s) => (distance(s) < distance(best) ? s : best));
}

/// Les services où une réservation apparaît : le sien (d'après son heure de début) et seulement ceux qu'elle
/// BLOQUE explicitement ("bloquer aussi le service suivant", "toute la soirée"). Une réservation de 19h30 qui
/// finit après le début du service suivant ne s'y compte pas pour autant : elle y occupe la table, mais elle
/// appartient au premier service.
export function servicesOfReservation(
  services: ServiceWindow[],
  r: { time: string; spansNextService: boolean; blocksEvening: boolean }
): ServiceWindow[] {
  const own = assignService(services, r.time);
  if (!own) return [];
  const result = [own];
  const later = sorted(services).filter((s) => timeToMinutes(s.startTime) >= timeToMinutes(own.endTime));
  if (r.blocksEvening && timeToMinutes(r.time) >= EVENING_START_MINUTES) result.push(...later);
  else if (r.spansNextService && later[0]) result.push(later[0]);
  return result;
}

/// Couverts par service : chaque réservation est comptée UNE fois, dans son propre service (annulations et
/// absences exclues). Le total de tous les services est donc la somme exacte des lignes.
export function coversPerService(
  services: ServiceWindow[],
  reservations: { time: string; partySize: number; status: string }[]
): { service: ServiceWindow & {}; covers: number }[] {
  const totals = new Map<string, number>(services.map((s) => [s.id, 0]));
  for (const r of reservations) {
    if (r.status === "cancelled" || r.status === "no_show") continue;
    const own = assignService(services, r.time);
    if (own) totals.set(own.id, (totals.get(own.id) ?? 0) + r.partySize);
  }
  return sorted(services).map((service) => ({ service, covers: totals.get(service.id) ?? 0 }));
}
