"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";

export type AvailabilityGridService = { id: string; name: string; daysOfWeek: number[] };

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

export function cellKey(dayOfWeek: number, serviceId: string) {
  return `${dayOfWeek}:${serviceId}`;
}

/// Rendu jour × service partagé par les trois variantes ci-dessous (éditable en direct,
/// éditable en local avant sauvegarde, lecture seule) — seule la provenance de l'état
/// (serveur, formulaire local, ou figée) diffère entre elles.
function ServiceGridRows({
  services,
  isChecked,
  onToggle,
  onToggleDay,
}: {
  services: AvailabilityGridService[];
  isChecked: (dayOfWeek: number, serviceId: string) => boolean;
  onToggle: (dayOfWeek: number, serviceId: string, next: boolean) => void;
  onToggleDay: (dayOfWeek: number, servicesToday: AvailabilityGridService[], next: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const servicesToday = services.filter((s) => s.daysOfWeek.includes(day.value));
        if (servicesToday.length === 0) return null;
        const allChecked = servicesToday.every((s) => isChecked(day.value, s.id));

        return (
          <div key={day.value} className="flex flex-wrap items-center gap-2">
            <span className="w-9 shrink-0 text-xs font-medium text-muted-foreground">{day.label}</span>
            {servicesToday.map((service) => {
              const checked = isChecked(day.value, service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onToggle(day.value, service.id, !checked)}
                  aria-pressed={checked}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                    checked ? "border-good bg-good-soft text-good" : "border-border bg-card text-foreground hover:bg-muted"
                  )}
                >
                  {service.name}
                </button>
              );
            })}
            {servicesToday.length > 1 && (
              <button
                type="button"
                onClick={() => onToggleDay(day.value, servicesToday, !allChecked)}
                aria-pressed={allChecked}
                className={cn(
                  "rounded-2xl border border-dashed px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  allChecked ? "border-good bg-good-soft text-good" : "border-border text-muted-foreground hover:bg-muted"
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

/// Grille jour × service qui persiste chaque clic tout de suite — vue employé
/// (flexijob, voir myspace/components/availability-toggles.tsx) et vue manager (fiche
/// employé, voir staff/components/employee-schedule-grid.tsx). Pour la sélection avant
/// création d'un compte (pas encore de membershipId à qui écrire), voir
/// SelectableServiceGrid plus bas.
export function EditableServiceGrid({
  services,
  initialCells,
  onToggleOne,
  onToggleMany,
}: {
  services: AvailabilityGridService[];
  initialCells: { dayOfWeek: number; serviceId: string }[];
  onToggleOne: (dayOfWeek: number, serviceId: string, next: boolean) => Promise<void>;
  onToggleMany: (dayOfWeek: number, serviceIds: string[], next: boolean) => Promise<void>;
}) {
  const [cells, setCells] = useState(new Set(initialCells.map((c) => cellKey(c.dayOfWeek, c.serviceId))));
  const [, startTransition] = useTransition();

  function toggleOne(dayOfWeek: number, serviceId: string, nextValue: boolean) {
    const key = cellKey(dayOfWeek, serviceId);
    setCells((prev) => {
      const next = new Set(prev);
      if (nextValue) next.add(key);
      else next.delete(key);
      return next;
    });
    startTransition(async () => {
      try {
        await onToggleOne(dayOfWeek, serviceId, nextValue);
      } catch (err) {
        setCells((prev) => {
          const reverted = new Set(prev);
          if (nextValue) reverted.delete(key);
          else reverted.add(key);
          return reverted;
        });
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  function toggleWholeDay(dayOfWeek: number, servicesToday: AvailabilityGridService[], nextValue: boolean) {
    const keys = servicesToday.map((s) => cellKey(dayOfWeek, s.id));
    setCells((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (nextValue) next.add(key);
        else next.delete(key);
      }
      return next;
    });
    startTransition(async () => {
      try {
        await onToggleMany(
          dayOfWeek,
          servicesToday.map((s) => s.id),
          nextValue
        );
      } catch (err) {
        setCells((prev) => {
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
    <ServiceGridRows
      services={services}
      isChecked={(d, s) => cells.has(cellKey(d, s))}
      onToggle={toggleOne}
      onToggleDay={toggleWholeDay}
    />
  );
}

/// Même grille, contrôlée en local par le formulaire appelant — pour choisir l'horaire
/// habituel AVANT que le compte existe (création d'un employé), où il n'y a encore rien
/// en base à mettre à jour cellule par cellule. `value`/`onChange` portent l'état, à
/// sérialiser par l'appelant (voir new-employee-form.tsx) au moment de la soumission.
export function SelectableServiceGrid({
  services,
  value,
  onChange,
}: {
  services: AvailabilityGridService[];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  function toggleOne(dayOfWeek: number, serviceId: string, nextValue: boolean) {
    const key = cellKey(dayOfWeek, serviceId);
    const next = new Set(value);
    if (nextValue) next.add(key);
    else next.delete(key);
    onChange(next);
  }

  function toggleWholeDay(dayOfWeek: number, servicesToday: AvailabilityGridService[], nextValue: boolean) {
    const next = new Set(value);
    for (const s of servicesToday) {
      const key = cellKey(dayOfWeek, s.id);
      if (nextValue) next.add(key);
      else next.delete(key);
    }
    onChange(next);
  }

  return (
    <ServiceGridRows
      services={services}
      isChecked={(d, s) => value.has(cellKey(d, s))}
      onToggle={toggleOne}
      onToggleDay={toggleWholeDay}
    />
  );
}

/// Même grille, en lecture seule — statut fixe côté employé (manager décide), ou tout
/// affichage qui ne doit pas permettre l'édition.
export function ReadOnlyServiceGrid({
  services,
  cells,
  emptyMessage,
}: {
  services: AvailabilityGridService[];
  cells: { dayOfWeek: number; serviceId: string }[];
  emptyMessage: string;
}) {
  const cellSet = new Set(cells.map((c) => cellKey(c.dayOfWeek, c.serviceId)));
  if (cells.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const servicesToday = services.filter((s) => s.daysOfWeek.includes(day.value) && cellSet.has(cellKey(day.value, s.id)));
        if (servicesToday.length === 0) return null;
        return (
          <div key={day.value} className="flex flex-wrap items-center gap-2">
            <span className="w-9 shrink-0 text-xs font-medium text-muted-foreground">{day.label}</span>
            {servicesToday.map((service) => (
              <span key={service.id} className="rounded-2xl border border-good bg-good-soft px-3 py-2 text-xs font-medium text-good">
                {service.name}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
