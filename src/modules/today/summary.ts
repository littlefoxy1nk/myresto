import { isoWeekday, nowMinutes, timeToMinutes } from "@/lib/time";
import { serviceRange } from "@/lib/service-label";
import { EVENING_START_MINUTES } from "@/modules/service/spans";

export type TodayService = { id: string; name: string; startTime: string; endTime: string; daysOfWeek: number[] };

export type ServiceGroup = {
  /// "current" = un service de cette période est en cours ; "upcoming" = la période n'a pas encore commencé
  /// (ou son prochain service n'a pas commencé).
  status: "current" | "upcoming";
  /// Les services de la période qui ne sont pas encore terminés (ceux dont on parle).
  services: TodayService[];
  /// La plage complète de la période (du début du premier service à la fin du dernier) : les couverts et
  /// l'équipe se comptent sur toute la période, pas seulement sur ce qui reste.
  window: { start: string; end: string };
  /// Tous les services de la période (terminés ou non) : les couverts se comptent sur chacun.
  periodServices: TodayService[];
};

const periodOf = (s: { startTime: string }) => (timeToMinutes(s.startTime) >= EVENING_START_MINUTES ? "evening" : "midday");

/// Le « service d'aujourd'hui » dont parler : celui qui se déroule ou, à défaut, le prochain — mais pour le soir
/// on parle TOUJOURS de tous les services du soir ensemble (ex : 18h et 20h30), pas d'un seul. Null s'il n'en
/// reste plus aujourd'hui.
export function resolveServiceGroup(services: TodayService[], now: Date): ServiceGroup | null {
  const today = services.filter((s) => s.daysOfWeek.includes(isoWeekday(now))).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const minutes = nowMinutes(now);

  const current = today.find((s) => minutes >= timeToMinutes(s.startTime) && minutes < timeToMinutes(s.endTime));
  const next = today.find((s) => timeToMinutes(s.startTime) > minutes);
  const reference = current ?? next;
  if (!reference) return null;

  const period = periodOf(reference);
  const samePeriod = today.filter((s) => periodOf(s) === period);
  const remaining = samePeriod.filter((s) => timeToMinutes(s.endTime) > minutes);
  const started = samePeriod.some((s) => timeToMinutes(s.startTime) <= minutes);

  return {
    status: current || started ? "current" : "upcoming",
    services: remaining,
    window: { start: samePeriod[0].startTime, end: samePeriod[samePeriod.length - 1].endTime },
    periodServices: samePeriod,
  };
}

/// "A", "A et B", "A, B et C".
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

/// « de 12h à 15h » ; plusieurs : « de 18h à 20h30 et de 20h30 à 22h ». Toujours par horaires, jamais par un nom générique.
export function formatServiceRanges(services: { startTime: string; endTime: string }[]): string {
  return joinList(services.map((s) => serviceRange(s.startTime, s.endTime)));
}

/// Une majuscule au début de chaque prénom saisi en minuscules ("cesim" → "Cesim", "jean-paul" → "Jean-Paul").
export function capitalizeName(name: string): string {
  return name.trim().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}

const DEPARTMENTS = [
  { key: "cuisine", label: "Cuisine" },
  { key: "salle", label: "Salle" },
  { key: "bar", label: "Bar" },
  { key: "plonge", label: "Plonge" },
  { key: "direction", label: "Direction" },
] as const;

export type DepartmentLine = { key: string; label: string; names: string[] };

/// Qui travaille, par poste (cuisine, salle, bar…), sur la plage : un horaire qui chevauche la plage compte.
/// Chaque prénom n'apparaît qu'une fois par poste.
export function teamByDepartment(
  shifts: { firstName: string; position: string; startTime: string; endTime: string }[],
  window: { start: string; end: string }
): DepartmentLine[] {
  const from = timeToMinutes(window.start);
  const to = timeToMinutes(window.end);
  const overlapping = shifts.filter((s) => timeToMinutes(s.startTime) < to && timeToMinutes(s.endTime) > from);

  const known = new Set<string>(DEPARTMENTS.map((d) => d.key));
  const lines: DepartmentLine[] = DEPARTMENTS.map((d) => ({
    key: d.key,
    label: d.label,
    names: [...new Set(overlapping.filter((s) => s.position === d.key).map((s) => capitalizeName(s.firstName)))].sort((a, b) => a.localeCompare(b, "fr")),
  }));
  const others = [...new Set(overlapping.filter((s) => !known.has(s.position)).map((s) => capitalizeName(s.firstName)))].sort((a, b) =>
    a.localeCompare(b, "fr")
  );
  if (others.length > 0) lines.push({ key: "autres", label: "Autres", names: others });
  return lines.filter((l) => l.names.length > 0);
}
