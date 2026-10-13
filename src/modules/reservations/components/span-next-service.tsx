"use client";

import { isoWeekday, timeToMinutes } from "@/lib/time";
import { nextServiceAfter, type ServiceWindow } from "@/modules/service/spans";

export type ServiceWithDays = ServiceWindow & { days: number[] };

/// Services qui tournent le jour choisi (l'écran reçoit tous les services de l'établissement).
export function servicesOnDate(services: ServiceWithDays[], date: string): ServiceWindow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const weekday = isoWeekday(new Date(`${date}T00:00:00`));
  return services.filter((s) => s.days.includes(weekday));
}

/// Case "bloquer aussi le service suivant" : n'apparaît que s'il existe un service après
/// l'heure choisie ce jour-là (ex: arrivée à 19h, services de 18h et 20h30).
export function SpanNextService({
  services,
  date,
  time,
  checked,
  onChange,
}: {
  services: ServiceWithDays[];
  date: string;
  time: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const next = time ? nextServiceAfter(servicesOnDate(services, date), time) : null;
  if (!next) return null;
  const until = next.endTime;
  const fromMinutes = timeToMinutes(time);
  const hours = Math.round(((timeToMinutes(until) - fromMinutes) / 60) * 10) / 10;

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
      />
      <span>
        <span className="font-medium">Bloquer aussi le service « {next.name} » ({next.startTime})</span>
        <span className="block text-xs text-muted-foreground">
          La table reste prise jusqu&apos;à {until} (≈ {hours} h) et s&apos;affiche sur les deux services.
        </span>
      </span>
    </label>
  );
}
