import { z } from "zod";

export const CountdownSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom à l'événement.").max(60, "Nom trop long (60 caractères maximum)."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisis une date."),
});
export type CountdownInput = z.infer<typeof CountdownSchema>;

const DAY_MS = 86_400_000;

function dayNumber(year: number, monthIndex: number, day: number) {
  return Math.round(Date.UTC(year, monthIndex, day) / DAY_MS);
}

/// Nombre de jours calendaires entre aujourd'hui et le jour de l'événement ("yyyy-MM-dd") : 0 = aujourd'hui,
/// négatif = passé. Compté en jours entiers sur le calendrier local, jamais en heures (pas de décalage d'heure d'été).
export function daysUntil(dateKey: string, today: Date): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return dayNumber(y, m - 1, d) - dayNumber(today.getFullYear(), today.getMonth(), today.getDate());
}

export function describeDays(days: number): { big: string; unit: string } {
  if (days === 0) return { big: "Aujourd'hui", unit: "c'est le jour J" };
  if (days === 1) return { big: "Demain", unit: "c'est pour demain" };
  return { big: String(days), unit: `jours avant l'événement` };
}

/// Les événements à venir (aujourd'hui inclus), le plus proche d'abord ; les passés ne s'affichent plus.
export function upcomingEvents<T extends { date: string }>(events: T[], today: Date): (T & { days: number })[] {
  return events
    .map((e) => ({ ...e, days: daysUntil(e.date, today) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days || a.date.localeCompare(b.date));
}
