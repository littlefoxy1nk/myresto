import { timeToMinutes, nowMinutes, isoWeekday } from "@/lib/time";
import type { ServiceWindow } from "./types";

export type ServiceDefinitionInput = {
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
};

export type ActiveServiceResolution = {
  current: ServiceWindow;
  next: (NonNullable<ServiceWindow> & { minutesFromNow: number }) | null;
};

/// Unique source de vérité pour "quel service est actif maintenant" — comparaison des
/// horaires réels des ServiceDefinition à l'heure courante, jamais déduit d'une
/// réservation. Utilisée par Mode Service, Aujourd'hui et tout futur module qui doit
/// répondre à la même question ; ne jamais réimplémenter cette comparaison ailleurs.
/// Pure (prend `now` en paramètre) pour rester testable sans horloge système.
export function resolveActiveService(services: ServiceDefinitionInput[], now: Date = new Date()): ActiveServiceResolution {
  const isoDay = isoWeekday(now);
  const currentMinutes = nowMinutes(now);

  const todaysServices = services.filter((s) => s.daysOfWeek.includes(isoDay));

  const currentDef = todaysServices.find(
    (s) => currentMinutes >= timeToMinutes(s.startTime) && currentMinutes < timeToMinutes(s.endTime)
  );
  const nextDef = todaysServices
    .filter((s) => timeToMinutes(s.startTime) > currentMinutes)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0];

  return {
    current: currentDef ? { name: currentDef.name, startTime: currentDef.startTime, endTime: currentDef.endTime } : null,
    next: nextDef
      ? {
          name: nextDef.name,
          startTime: nextDef.startTime,
          endTime: nextDef.endTime,
          minutesFromNow: timeToMinutes(nextDef.startTime) - currentMinutes,
        }
      : null,
  };
}
