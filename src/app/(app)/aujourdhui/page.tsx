import Link from "next/link";
import { format } from "date-fns";
import { getCurrentContext } from "@/lib/current-context";
import { computeTodaySummary, type TodayActiveService } from "@/modules/insights/server/today-intelligence";
import { estimateTodayRevenue } from "@/modules/finance/server/forecast";
import { getTodayClosing } from "@/modules/finance/server/queries";
import { ClosingButton } from "@/modules/finance/components/closing-button";
import { ReservationActionButton } from "@/modules/reservations/components/reservation-action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Eye, Clock, LineChart, Boxes, CalendarDays, Palmtree, Megaphone } from "lucide-react";
import { RESERVATION_STATUS_LABEL } from "@/modules/reservations/status";

const SEVERITY_CONFIG = {
  urgent: { icon: AlertTriangle, bg: "bg-urgent-soft", text: "text-urgent", variant: "urgent" as const, label: "Urgent" },
  important: { icon: AlertCircle, bg: "bg-important-soft", text: "text-important", variant: "important" as const, label: "Important" },
  watch: { icon: Eye, bg: "bg-watch-soft", text: "text-watch", variant: "watch" as const, label: "À surveiller" },
};

function formatTimeFromNow(minutes: number) {
  if (minutes <= 0) return "maintenant";
  if (minutes < 60) return `dans ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `dans ${h}h` : `dans ${h}h${String(m).padStart(2, "0")}`;
}

/// Toujours dérivé de la même source de vérité que Mode Service (resolveActiveService)
/// — jamais une déduction depuis une réservation. "none" est dit tel quel : un patron
/// doit pouvoir faire confiance à cette ligne pour savoir où il en est, pas deviner.
function formatActiveService(activeService: TodayActiveService): string {
  if (activeService.status === "current") return `${activeService.name} en cours`;
  if (activeService.status === "upcoming") return `Prochain service : ${activeService.name} à ${activeService.startTime}`;
  return "Aucun service actif en ce moment";
}

export default async function AujourdhuiPage() {
  const ctx = await getCurrentContext();
  const summary = await computeTodaySummary(ctx.establishment.id);
  const revenue = await estimateTodayRevenue(ctx.establishment.id, summary.covers);
  const canEditReservations = ctx.can("reservations.edit");
  const canManageFinance = ctx.can("finance.manage");
  const todayClosing = canManageFinance ? await getTodayClosing(ctx.establishment.id) : null;
  const todayDateKey = format(summary.date, "yyyy-MM-dd");

  const dateLabel = new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(summary.date);

  const canSeeFinances = ctx.can("finance.view");
  const canSeeStock = ctx.can("inventory.view");
  const canSeePlanning = ctx.can("schedule.view");
  const canSeeTimeOff = ctx.can("timeoff.manage");
  const canSeeMarketing = ctx.can("marketing.view");
  const hasQuickLinks = canSeeFinances || canSeeStock || canSeePlanning || canSeeTimeOff || canSeeMarketing;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-sm capitalize text-muted-foreground">{dateLabel}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Aujourd&apos;hui</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {ctx.establishment.name} · {formatActiveService(summary.activeService)}
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
                  {RESERVATION_STATUS_LABEL[summary.nextUp.status]}
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
        {/* Pas de pourcentage si aucun service ne permet de le rattacher à une capacité
            comparable — voir occupancy dans today-intelligence.ts. */}
        {summary.occupancy && (
          <Kpi label={`Occupation · ${summary.occupancy.serviceName}`} value={`${Math.round(summary.occupancy.rate * 100)}%`} />
        )}
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

      {/* Clôture et raccourcis de navigation — volontairement en bas de page : ce sont
          des actions/liens secondaires, jamais plus visibles que la prochaine échéance
          ou les alertes du moment. */}
      {canManageFinance && (
        <div>
          <ClosingButton
            date={todayDateKey}
            dateLabel="aujourd'hui"
            initialRevenueCents={todayClosing?.revenueCents ?? null}
            initialCovers={todayClosing?.covers ?? null}
            alreadyClosed={todayClosing != null}
          />
        </div>
      )}

      {/* Finances, Stock, Planning, Congés et Communication vivent dans la barre latérale
          desktop mais n'ont pas d'onglet dans la barre de navigation mobile (6 places
          déjà prises) — ce raccourci est leur seul point d'entrée sur mobile pour les
          rôles concernés. */}
      {hasQuickLinks && (
        <div className="grid grid-cols-2 gap-2 md:hidden">
          {canSeePlanning && (
            <Button asChild size="sm" variant="secondary">
              <Link href="/planning">
                <CalendarDays size={15} aria-hidden="true" />
                Planning
              </Link>
            </Button>
          )}
          {canSeeTimeOff && (
            <Button asChild size="sm" variant="secondary">
              <Link href="/conges">
                <Palmtree size={15} aria-hidden="true" />
                Congés
              </Link>
            </Button>
          )}
          {canSeeFinances && (
            <Button asChild size="sm" variant="secondary">
              <Link href="/finances">
                <LineChart size={15} aria-hidden="true" />
                Finances
              </Link>
            </Button>
          )}
          {canSeeStock && (
            <Button asChild size="sm" variant="secondary">
              <Link href="/stock">
                <Boxes size={15} aria-hidden="true" />
                Stock
              </Link>
            </Button>
          )}
          {canSeeMarketing && (
            <Button asChild size="sm" variant="secondary">
              <Link href="/marketing">
                <Megaphone size={15} aria-hidden="true" />
                Communication
              </Link>
            </Button>
          )}
        </div>
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
