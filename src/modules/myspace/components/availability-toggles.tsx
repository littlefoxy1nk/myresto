"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { setMyDayUnavailability, setMyServiceUnavailability, setMyServicesUnavailability } from "@/modules/myspace/server/actions";
import type { MyAvailabilityService } from "@/modules/myspace/types";

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

function cellKey(dayOfWeek: number, serviceId: string) {
  return `${dayOfWeek}:${serviceId}`;
}

/// Toggle simple par jour — utilisé uniquement quand l'établissement n'a configuré
/// aucun service (voir ServiceDefinition) : la journée entière reste la seule notion
/// disponible dans ce cas, comme avant l'ajout des disponibilités par service.
function WholeDayToggles({ initialUnavailableDays }: { initialUnavailableDays: number[] }) {
  const [unavailable, setUnavailable] = useState(new Set(initialUnavailableDays));
  const [, startTransition] = useTransition();

  function toggle(day: number) {
    const next = new Set(unavailable);
    const willBeUnavailable = !next.has(day);
    if (willBeUnavailable) next.add(day);
    else next.delete(day);
    setUnavailable(next);

    startTransition(async () => {
      try {
        await setMyDayUnavailability(day, willBeUnavailable);
      } catch (err) {
        setUnavailable(unavailable);
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {DAYS.map((day) => {
        const isUnavailable = unavailable.has(day.value);
        return (
          <button
            key={day.value}
            type="button"
            onClick={() => toggle(day.value)}
            aria-pressed={isUnavailable}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              isUnavailable ? "border-urgent bg-urgent-soft text-urgent" : "border-border bg-background text-foreground hover:bg-muted"
            )}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}

/// Grille par service dès que l'établissement en a configuré au moins un — un
/// restaurant à deux services (déjeuner/dîner) déclare son indisponibilité service par
/// service ; "Toute la journée" reste un raccourci qui coche tous les services du jour
/// d'un coup, pas un troisième mode de stockage (voir setMyServiceUnavailability).
function PerServiceToggles({
  services,
  initialUnavailableServiceCells,
}: {
  services: MyAvailabilityService[];
  initialUnavailableServiceCells: { dayOfWeek: number; serviceId: string }[];
}) {
  const [unavailableCells, setUnavailableCells] = useState(
    new Set(initialUnavailableServiceCells.map((c) => cellKey(c.dayOfWeek, c.serviceId)))
  );
  const [, startTransition] = useTransition();

  function toggleService(dayOfWeek: number, serviceId: string, nextValue: boolean) {
    const key = cellKey(dayOfWeek, serviceId);
    setUnavailableCells((prev) => {
      const next = new Set(prev);
      if (nextValue) next.add(key);
      else next.delete(key);
      return next;
    });

    startTransition(async () => {
      try {
        await setMyServiceUnavailability(dayOfWeek, serviceId, nextValue);
      } catch (err) {
        setUnavailableCells((prev) => {
          const reverted = new Set(prev);
          if (nextValue) reverted.delete(key);
          else reverted.add(key);
          return reverted;
        });
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  function toggleWholeDay(dayOfWeek: number, servicesToday: MyAvailabilityService[], nextValue: boolean) {
    const keys = servicesToday.map((s) => cellKey(dayOfWeek, s.id));
    setUnavailableCells((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (nextValue) next.add(key);
        else next.delete(key);
      }
      return next;
    });

    startTransition(async () => {
      try {
        await setMyServicesUnavailability(
          dayOfWeek,
          servicesToday.map((s) => s.id),
          nextValue
        );
      } catch (err) {
        setUnavailableCells((prev) => {
          const reverted = new Set(prev);
          for (const key of keys) {
            if (nextValue) reverted.delete(key);
            else reverted.add(key);
          }
          return reverted;
        });
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const servicesToday = services.filter((s) => s.daysOfWeek.includes(day.value));
        if (servicesToday.length === 0) return null;
        const allUnavailable = servicesToday.every((s) => unavailableCells.has(cellKey(day.value, s.id)));

        return (
          <div key={day.value} className="flex flex-wrap items-center gap-2">
            <span className="w-9 shrink-0 text-xs font-medium text-muted-foreground">{day.label}</span>
            {servicesToday.map((service) => {
              const isUnavailable = unavailableCells.has(cellKey(day.value, service.id));
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(day.value, service.id, !isUnavailable)}
                  aria-pressed={isUnavailable}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                    isUnavailable ? "border-urgent bg-urgent-soft text-urgent" : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {service.name}
                </button>
              );
            })}
            {servicesToday.length > 1 && (
              <button
                type="button"
                onClick={() => toggleWholeDay(day.value, servicesToday, !allUnavailable)}
                aria-pressed={allUnavailable}
                className={cn(
                  "rounded-xl border border-dashed px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  allUnavailable ? "border-urgent bg-urgent-soft text-urgent" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                Toute la journée
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AvailabilityToggles({
  services,
  initialUnavailableDays,
  initialUnavailableServiceCells,
}: {
  services: MyAvailabilityService[];
  initialUnavailableDays: number[];
  initialUnavailableServiceCells: { dayOfWeek: number; serviceId: string }[];
}) {
  if (services.length === 0) {
    return <WholeDayToggles initialUnavailableDays={initialUnavailableDays} />;
  }
  return <PerServiceToggles services={services} initialUnavailableServiceCells={initialUnavailableServiceCells} />;
}
