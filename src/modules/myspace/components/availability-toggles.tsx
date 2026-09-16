"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { setMyDayUnavailability } from "@/modules/myspace/server/actions";

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

/// Indisponibilité déclarée jour entier — pas de plage horaire ici, voir le
/// commentaire sur setMyDayUnavailability. Un simple bascule par jour, à jour
/// optimiste pour rester réactif au toucher.
export function AvailabilityToggles({ initialUnavailableDays }: { initialUnavailableDays: number[] }) {
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
        setUnavailable(unavailable); // revert
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
