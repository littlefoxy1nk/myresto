import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FrequentationSignal } from "@/modules/frequentation/types";

/// Uniquement des faits de fréquentation (couverts attendus vs. historique du même jour
/// de semaine) — jamais croisés avec le personnel planifié, qui vit ailleurs sur cette
/// même page. Le patron fait le rapprochement lui-même ; MYRESTO fournit le signal, pas
/// une conclusion sur l'effectif.
export function FrequentationSummary({
  days,
}: {
  days: { date: string; dateLabel: string; signal: FrequentationSignal }[];
}) {
  const notable = days.filter((d) => d.signal.level === "elevee" || d.signal.level === "faible");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fréquentation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {notable.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune fréquentation inhabituelle cette semaine.</p>
        )}
        {notable.map((d) => {
          const elevee = d.signal.level === "elevee";
          return (
            <div
              key={d.date}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-border px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{d.dateLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {d.signal.expectedCovers} couvert{d.signal.expectedCovers > 1 ? "s" : ""} attendu
                  {d.signal.expectedCovers > 1 ? "s" : ""} contre {d.signal.historicalAverageCovers} habituellement
                </p>
              </div>
              <Badge variant={elevee ? "important" : "watch"} className="shrink-0">
                {elevee ? "Inhabituelle" : "Calme"}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
