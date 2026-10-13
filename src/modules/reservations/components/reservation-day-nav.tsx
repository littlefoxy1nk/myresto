"use client";

import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/// Jour et service affichés dans la liste des réservations — l'état tient dans l'URL
/// (?date=yyyy-MM-dd&service=<id>), comme sur le plan de salle.
export function ReservationDayNav({
  dateKey,
  todayKey,
  services,
  serviceId,
}: {
  dateKey: string;
  todayKey: string;
  services: { id: string; name: string }[];
  serviceId: string | null;
}) {
  const router = useRouter();

  function go(nextDate: string, nextService: string | null) {
    const params = new URLSearchParams();
    if (nextDate !== todayKey) params.set("date", nextDate);
    if (nextService) params.set("service", nextService);
    const qs = params.toString();
    router.push(qs ? `/reservations?${qs}` : "/reservations");
  }

  const shift = (days: number) => go(format(addDays(new Date(`${dateKey}T00:00:00`), days), "yyyy-MM-dd"), null);
  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
      active ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
    );
  const arrow =
    "rounded-lg p-2 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => shift(-1)} className={arrow}>
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="sr-only">Jour précédent</span>
        </button>
        <input
          type="date"
          aria-label="Date des réservations"
          value={dateKey}
          onChange={(e) => e.target.value && go(e.target.value, null)}
          className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button type="button" onClick={() => shift(1)} className={arrow}>
          <ChevronRight size={16} aria-hidden="true" />
          <span className="sr-only">Jour suivant</span>
        </button>
        {dateKey !== todayKey && (
          <button type="button" onClick={() => go(todayKey, null)} className={pill(false)}>
            Aujourd&apos;hui
          </button>
        )}
      </div>
      {services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => go(dateKey, null)} className={pill(!serviceId)}>
            Journée
          </button>
          {services.map((sv) => (
            <button key={sv.id} type="button" onClick={() => go(dateKey, sv.id)} className={pill(serviceId === sv.id)}>
              {sv.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
