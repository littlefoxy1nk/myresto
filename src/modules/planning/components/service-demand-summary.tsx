import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DemandLevel, PlanningDayService } from "@/modules/planning/types";

const DEMAND_LABEL: Record<DemandLevel, string> = {
  indeterminee: "Indéterminée",
  faible: "Faible",
  moderee: "Modérée",
  elevee: "Élevée",
};

const DEMAND_VARIANT: Record<DemandLevel, "neutral" | "accent" | "watch"> = {
  indeterminee: "neutral",
  faible: "neutral",
  moderee: "watch",
  elevee: "accent",
};

/// Affiche, pour chaque service actif de la semaine, la demande attendue à côté du
/// personnel planifié — deux faits indépendants côte à côte, jamais transformés en un
/// seul ratio. Le lecteur fait le rapprochement lui-même ; les cas qui méritent une
/// alerte explicite sont déjà remontés séparément par PlanningAlerts.
export function ServiceDemandSummary({ dayServices }: { dayServices: PlanningDayService[] }) {
  // Un service sans aucune réservation et sans personne planifiée n'apporte rien à la
  // lecture — mieux vaut une liste courte et pertinente qu'une ligne à 0 par service et
  // par jour (ex: un déjeuner jamais utilisé dans cet établissement).
  const relevant = dayServices.filter((ds) => ds.covers > 0 || ds.staffCount > 0);
  if (dayServices.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Charge attendue par service</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {relevant.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune réservation ni personnel planifié cette semaine.</p>
        )}
        {relevant.map((ds) => (
          <div
            key={`${ds.date}-${ds.serviceId}`}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-border px-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {ds.dateLabel} · {ds.serviceName}
              </p>
              <p className="text-xs text-muted-foreground">
                {ds.covers} couvert{ds.covers > 1 ? "s" : ""} prévu{ds.covers > 1 ? "s" : ""} ({ds.reservationsCount} résa.) ·{" "}
                {ds.staffCount} personne{ds.staffCount > 1 ? "s" : ""} planifiée{ds.staffCount > 1 ? "s" : ""}
              </p>
            </div>
            <Badge variant={DEMAND_VARIANT[ds.demandLevel]} className="shrink-0">
              Charge {DEMAND_LABEL[ds.demandLevel].toLowerCase()}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
