import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { TodayOverview } from "@/modules/today/server/queries";

/// Le résumé du jour en un coup d'œil : le(s) service(s), les couverts réservés (tous les services du soir ensemble)
/// et qui travaille en cuisine, en salle…
export function TodaySummaryCard({ overview, canSeePlanning }: { overview: TodayOverview; canSeePlanning: boolean }) {
  const { service, covers, team } = overview;

  if (!service) {
    return (
      <Card className="flex h-full flex-col justify-center p-6">
        <p className="text-lg font-semibold tracking-tight">Plus de service aujourd&apos;hui</p>
        <p className="mt-1 text-sm text-muted-foreground">Le résumé du prochain service réapparaît ici.</p>
      </Card>
    );
  }

  const live = service.status === "current";
  const eyebrow = live
    ? service.remaining > 1
      ? "Services en cours"
      : "Service en cours"
    : service.remaining > 1
      ? "Prochains services"
      : "Prochain service";

  return (
    <Card className="relative h-full overflow-hidden border-0 bg-sidebar p-6 text-sidebar-foreground shadow-pop">
      {/* Lueurs décoratives : donnent de la profondeur à la carte sans rien dire de plus. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-accent-2/25 blur-3xl" />

      <div className="relative space-y-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            {live && (
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
              </span>
            )}
            {eyebrow}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight md:text-[28px]">{service.label.charAt(0).toUpperCase() + service.label.slice(1)}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-10">
          {covers !== null && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Couverts réservés</p>
              <p className="mt-1 text-6xl font-bold tabular-nums leading-none tracking-tight text-lime">{covers.total}</p>
              {covers.perService.length > 1 && (
                <ul className="mt-3 space-y-0.5 text-xs text-white/60">
                  {covers.perService.map((row) => (
                    <li key={row.label}>
                      {row.label} : <span className="font-semibold text-white">{row.covers}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Équipe</p>
            {team.length === 0 ? (
              <p className="mt-2 text-sm text-white/70">
                Aucun horaire publié pour ce service.{" "}
                {canSeePlanning && (
                  <Link href="/planning" className="font-semibold text-white underline underline-offset-2">
                    Ouvrir le planning
                  </Link>
                )}
              </p>
            ) : (
              <dl className="mt-2 space-y-2.5">
                {team.map((line) => (
                  <div key={line.key} className="flex flex-wrap items-center gap-1.5">
                    <dt className="mr-1 w-14 shrink-0 text-[13px] font-medium text-white/60">{line.label}</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {line.names.map((name) => (
                        <span key={name} className="rounded-full bg-white/[0.12] px-3 py-1 text-[13px] font-semibold text-white">
                          {name}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
