import Link from "next/link";
import { getCurrentContext } from "@/lib/current-context";
import { computeTodaySummary } from "@/modules/insights/server/today-intelligence";
import { estimateTodayRevenue } from "@/modules/finance/server/forecast";
import { ReservationActionButton } from "@/modules/reservations/components/reservation-action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Eye, Sparkles, Clock } from "lucide-react";

const SEVERITY_CONFIG = {
  urgent: { icon: AlertTriangle, bg: "bg-urgent-soft", text: "text-urgent", variant: "urgent" as const, label: "Urgent" },
  important: { icon: AlertCircle, bg: "bg-important-soft", text: "text-important", variant: "important" as const, label: "Important" },
  watch: { icon: Eye, bg: "bg-watch-soft", text: "text-watch", variant: "watch" as const, label: "À surveiller" },
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nouvelle",
  confirmed: "Confirmée",
  arrived: "Arrivée",
  seated: "Installée",
};

function formatTimeFromNow(minutes: number) {
  if (minutes <= 0) return "maintenant";
  if (minutes < 60) return `dans ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `dans ${h}h` : `dans ${h}h${String(m).padStart(2, "0")}`;
}

export default async function AujourdhuiPage() {
  const ctx = await getCurrentContext();
  const summary = await computeTodaySummary(ctx.establishment.id);
  const revenue = await estimateTodayRevenue(ctx.establishment.id, summary.covers);
  const canEditReservations = ctx.can("reservations.edit");

  const dateLabel = new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(summary.date);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-sm capitalize text-muted-foreground">{dateLabel}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Aujourd&apos;hui</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {ctx.establishment.name}
          {summary.serviceLabel ? ` · ${summary.serviceLabel}` : ""}
          {ctx.establishment.isDemo && <Badge variant="accent">Données de démonstration</Badge>}
        </p>
      </div>

      {/* Prochaine échéance — la première chose que raconte le dashboard, avant les
          chiffres agrégés : ce qui va concrètement se passer ensuite dans la salle. */}
      <Card className="border-accent/25 bg-accent-soft/40 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
          <Clock size={13} aria-hidden="true" />
          Prochaine échéance
        </div>
        {summary.nextUp ? (
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">
                {summary.nextUp.customerName} · {summary.nextUp.partySize} pers.
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {summary.nextUp.time}
                {summary.nextUp.tableLabels.length > 0 && ` · ${summary.nextUp.tableLabels.join(" + ")}`}
                {" · "}
                {formatTimeFromNow(summary.nextUp.minutesFromNow)}
                {" · "}
                <Badge variant={summary.nextUp.status === "new" ? "important" : "accent"}>
                  {STATUS_LABEL[summary.nextUp.status]}
                </Badge>
              </p>
            </div>
            {canEditReservations && summary.nextUp.status === "new" ? (
              <ReservationActionButton
                reservationId={summary.nextUp.id}
                targetStatus="confirmed"
                label="Confirmer"
                className="w-full sm:w-auto"
              />
            ) : (
              <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/reservations">Voir</Link>
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {summary.reservationsCount === 0
              ? "Aucune réservation aujourd'hui."
              : "Plus aucune réservation à venir pour le reste de la journée."}
          </p>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="CA prévu" value={formatCents(revenue.estimatedRevenueCents)} />
        <Kpi label="Réservations" value={String(summary.reservationsCount)} />
        <Kpi label="Couverts" value={String(summary.covers)} />
        <Kpi label="Personnel" value={String(summary.staffOnShift)} />
        <Kpi label="Occupation" value={`${Math.round(summary.occupancyRate * 100)}%`} />
      </div>

      {/* À faire */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">À faire</h2>
        {summary.alerts.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              Rien ne nécessite votre attention pour le moment. Bon service !
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {summary.alerts.map((alert) => {
              const config = SEVERITY_CONFIG[alert.severity];
              const Icon = config.icon;
              return (
                <Card key={alert.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="flex flex-1 items-start gap-3">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                      <Icon size={15} aria-hidden="true" className={config.text} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </div>
                      {alert.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{alert.description}</p>
                      )}
                    </div>
                  </div>
                  {alert.action && (
                    <Button size="sm" variant="outline" asChild className="w-full shrink-0 sm:w-auto">
                      <Link href={alert.action.href}>{alert.action.label}</Link>
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Recommandations */}
      {summary.recommendations.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles size={16} aria-hidden="true" className="text-accent" />
            Ce que je recommande
          </h2>
          <div className="space-y-2">
            {summary.recommendations.map((rec) => (
              <Card key={rec.id} className="p-4">
                <p className="text-sm font-medium">{rec.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{rec.description}</p>
                <div className="mt-3">
                  <Button size="sm" asChild>
                    <Link href={rec.actionHref}>{rec.actionLabel}</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
