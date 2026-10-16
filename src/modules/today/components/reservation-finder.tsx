"use client";

import { useMemo, useState } from "react";
import { MapPin, Search, SearchX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RESERVATION_STATUS_LABEL, RESERVATION_STATUS_VARIANT } from "@/modules/reservations/status";
import { searchReservations, type ReservationHit } from "@/modules/today/reservation-search";

/// « Où est installé M. Dupont ? » : on tape un nom, un téléphone ou un numéro de table, et on voit à quelle table la
/// réservation est assignée. Un clic sur la table la montre sur le plan.
export function ReservationFinder({
  reservations,
  planTableIds,
  onPickTable,
}: {
  reservations: ReservationHit[];
  /// Les tables visibles sur le plan affiché (un clic n'a de sens que pour celles-là).
  planTableIds?: ReadonlySet<string>;
  onPickTable?: (tableId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchReservations(reservations, query), [reservations, query]);
  const searching = query.trim().length > 0;

  return (
    <section aria-label="Chercher une réservation" className="rounded-3xl border border-border/70 bg-card p-4 shadow-card">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder="Chercher une réservation : nom, téléphone, table…"
          aria-label="Chercher une réservation du jour"
          autoComplete="off"
          className="w-full rounded-2xl border border-border bg-card/80 py-3 pl-11 pr-11 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Effacer la recherche"
            className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div aria-live="polite">
        {searching && results.length === 0 && (
          <p className="mt-3 flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <SearchX size={16} aria-hidden="true" />
            Aucune réservation aujourd&apos;hui ne correspond à « {query.trim()} ».
          </p>
        )}
        {results.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {results.map((r) => (
              <li key={r.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-3", (r.status === "cancelled" || r.status === "no_show") && "opacity-60")}>
                <span className="flex h-10 min-w-14 items-center justify-center rounded-2xl bg-accent-soft px-2 text-sm font-bold tabular-nums text-accent">{r.time}</span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-semibold">{r.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.partySize} pers. · <Badge variant={RESERVATION_STATUS_VARIANT[r.status]} className="px-2 py-0.5 text-[11px]">{RESERVATION_STATUS_LABEL[r.status] ?? r.status}</Badge>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.tables.length === 0 ? (
                    <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">Pas encore de table</span>
                  ) : (
                    r.tables.map((t) => {
                      const onPlan = !!onPickTable && !!planTableIds?.has(t.id);
                      const label = (
                        <>
                          <MapPin size={13} aria-hidden="true" />
                          Table {t.label}
                          <span className="font-normal opacity-70">· {t.zoneName}</span>
                        </>
                      );
                      return onPlan ? (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onPickTable(t.id)}
                          title="Voir cette table sur le plan"
                          className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-ink-foreground outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                        >
                          {label}
                        </button>
                      ) : (
                        <span key={t.id} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
                          {label}
                        </span>
                      );
                    })
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
