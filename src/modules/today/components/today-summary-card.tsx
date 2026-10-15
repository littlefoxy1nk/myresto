import Link from "next/link";
import { Card } from "@/components/ui/card";
import { joinList } from "@/modules/today/summary";
import type { TodayOverview } from "@/modules/today/server/queries";

/// Le résumé du jour en un coup d'œil : le(s) service(s), les couverts réservés (tous les services du soir ensemble)
/// et qui travaille en cuisine, en salle…
export function TodaySummaryCard({ overview, canSeePlanning }: { overview: TodayOverview; canSeePlanning: boolean }) {
  const { service, covers, team } = overview;

  if (!service) {
    return (
      <Card className="flex h-full flex-col justify-center p-5">
        <p className="text-base font-semibold">Plus de service aujourd&apos;hui</p>
        <p className="mt-1 text-sm text-muted-foreground">Le résumé du prochain service réapparaît ici.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {service.status === "current"
            ? service.remaining > 1
              ? "Services en cours"
              : "Service en cours"
            : service.remaining > 1
              ? "Prochains services"
              : "Prochain service"}
        </p>
        <p className="mt-0.5 text-xl font-semibold">{service.label.charAt(0).toUpperCase() + service.label.slice(1)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {covers !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Couverts réservés</p>
            <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight">{covers.total}</p>
            {covers.perService.length > 1 && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {covers.perService.map((row) => (
                  <li key={row.label}>
                    {row.label} : <span className="font-medium text-foreground">{row.covers}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Équipe</p>
          {team.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Aucun horaire publié pour ce service.{" "}
              {canSeePlanning && (
                <Link href="/planning" className="font-medium text-accent underline underline-offset-2">
                  Ouvrir le planning
                </Link>
              )}
            </p>
          ) : (
            <dl className="mt-1 space-y-0.5 text-sm">
              {team.map((line) => (
                <div key={line.key} className="flex gap-1.5">
                  <dt className="shrink-0 font-medium">{line.label} :</dt>
                  <dd>{joinList(line.names)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </Card>
  );
}
