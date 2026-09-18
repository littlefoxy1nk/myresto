"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { EditableServiceGrid, ReadOnlyServiceGrid } from "@/components/availability/editable-service-grid";
import { toast } from "@/lib/toast-bus";
import {
  setMyUsualAvailability,
  setMyUsualAvailabilityBulk,
  addMyOneOffAvailability,
  removeMyOneOffAvailability,
} from "@/modules/myspace/server/actions";
import type { MyAvailabilityService, MyDashboard } from "@/modules/myspace/types";

/// Ajout ponctuel "en plus" pour la semaine affichée — jamais une modification de
/// l'horaire habituel : une couleur distincte (accent) pour ne jamais confondre les
/// deux. Notifie qui construit le planning à chaque ajout (voir
/// addMyOneOffAvailability), retrait libre à tout moment.
function OneOffAvailabilitySection({
  services,
  currentWeekDates,
  initialOneOff,
}: {
  services: MyAvailabilityService[];
  currentWeekDates: string[];
  initialOneOff: { id: string; date: string; serviceId: string }[];
}) {
  const [entries, setEntries] = useState(initialOneOff);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function dateLabel(dateKey: string) {
    return new Intl.DateTimeFormat("fr-BE", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${dateKey}T00:00:00`));
  }

  function isoDayOfWeek(dateKey: string): number {
    const [y, m, d] = dateKey.split("-").map(Number);
    const day = new Date(y, m - 1, d).getDay();
    return day === 0 ? 7 : day;
  }

  function add(date: string, serviceId: string) {
    const key = `${date}:${serviceId}`;
    setPendingKey(key);
    startTransition(async () => {
      try {
        const result = await addMyOneOffAvailability({ date, serviceId });
        setEntries((prev) => [...prev, { id: result.id, date, serviceId }]);
        toast("Disponibilité ajoutée");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      } finally {
        setPendingKey(null);
      }
    });
  }

  function remove(entry: { id: string; date: string; serviceId: string }) {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    startTransition(async () => {
      try {
        await removeMyOneOffAvailability(entry.id);
      } catch (err) {
        setEntries((prev) => [...prev, entry]);
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  const entryKey = (date: string, serviceId: string) => `${date}:${serviceId}`;
  const entryByKey = new Map(entries.map((e) => [entryKey(e.date, e.serviceId), e]));

  return (
    <div className="space-y-2">
      {currentWeekDates.map((date) => {
        const servicesToday = services.filter((s) => s.daysOfWeek.includes(isoDayOfWeek(date)));
        if (servicesToday.length === 0) return null;
        return (
          <div key={date} className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{dateLabel(date)}</span>
            {servicesToday.map((service) => {
              const key = entryKey(date, service.id);
              const entry = entryByKey.get(key);
              const pending = pendingKey === key;
              if (entry) {
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => remove(entry)}
                    className="inline-flex items-center gap-1 rounded-xl border border-accent bg-accent-soft px-3 py-2 text-xs font-medium text-accent"
                  >
                    {service.name}
                    <X size={12} aria-hidden="true" />
                  </button>
                );
              }
              return (
                <button
                  key={service.id}
                  type="button"
                  disabled={pending}
                  onClick={() => add(date, service.id)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {pending ? "…" : `+ ${service.name}`}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function AvailabilityToggles({
  employmentType,
  services,
  usualAvailabilityCells,
  oneOffAvailability,
  currentWeekDates,
}: {
  employmentType: MyDashboard["employmentType"];
  services: MyAvailabilityService[];
  usualAvailabilityCells: { dayOfWeek: number; serviceId: string }[];
  oneOffAvailability: { id: string; date: string; serviceId: string }[];
  currentWeekDates: string[];
}) {
  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun service n&apos;est configuré pour cet établissement.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Horaire habituel</h3>
        {employmentType === "flexijob" ? (
          <EditableServiceGrid
            services={services}
            initialCells={usualAvailabilityCells}
            onToggleOne={setMyUsualAvailability}
            onToggleMany={setMyUsualAvailabilityBulk}
          />
        ) : (
          <ReadOnlyServiceGrid
            services={services}
            cells={usualAvailabilityCells}
            emptyMessage="Votre manager n'a pas encore renseigné votre horaire habituel."
          />
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Disponibilité en plus cette semaine</h3>
        <p className="text-xs text-muted-foreground">
          Ajoutez un service où vous pouvez travailler en plus de votre horaire habituel — votre manager en sera averti.
        </p>
        <OneOffAvailabilitySection services={services} currentWeekDates={currentWeekDates} initialOneOff={oneOffAvailability} />
      </div>
    </div>
  );
}
