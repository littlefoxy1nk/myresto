"use client";

import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FloorPlanDayService } from "@/modules/floorplan/server/queries";

/// Choix du jour (et du service) affichés sur le plan — l'état tient dans l'URL
/// (?date=yyyy-MM-dd&service=<id>), donc le lien d'un aperçu est partageable et le bouton
/// "retour" du navigateur fonctionne. Sans paramètre : le plan live d'aujourd'hui.
export function PlanDayPicker({
  dateKey,
  todayKey,
  services,
  serviceId,
}: {
  dateKey: string;
  todayKey: string;
  services: FloorPlanDayService[];
  serviceId: string | null;
}) {
  const router = useRouter();

  function go(nextDate: string, nextService: string | null) {
    if (nextDate === todayKey && !nextService) {
      router.push("/plan-de-salle");
      return;
    }
    const params = new URLSearchParams({ date: nextDate });
    if (nextService) params.set("service", nextService);
    router.push(`/plan-de-salle?${params.toString()}`);
  }

  function shift(days: number) {
    const d = addDays(new Date(`${dateKey}T00:00:00`), days);
    // Le service choisi peut ne pas exister ce jour-là : on repart sur "Journée".
    go(format(d, "yyyy-MM-dd"), null);
  }

  const isToday = dateKey === todayKey;
  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
      active ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-lg p-2 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="sr-only">Jour précédent</span>
        </button>
        <input
          type="date"
          aria-label="Date du plan"
          value={dateKey}
          onChange={(e) => e.target.value && go(e.target.value, null)}
          className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-lg p-2 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronRight size={16} aria-hidden="true" />
          <span className="sr-only">Jour suivant</span>
        </button>
        {!isToday && (
          <button type="button" onClick={() => go(todayKey, null)} className={pill(false)}>
            Aujourd&apos;hui
          </button>
        )}
      </div>

      {(!isToday || services.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => go(dateKey, null)} className={pill(!serviceId)}>
            {isToday ? "Maintenant" : "Journée"}
          </button>
          {services.map((sv) => (
            <button
              key={sv.id}
              type="button"
              onClick={() => go(dateKey, sv.id)}
              className={pill(serviceId === sv.id)}
            >
              {sv.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
