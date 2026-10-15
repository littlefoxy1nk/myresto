import { redirect } from "next/navigation";
import { requireModule } from "@/lib/module-guard";
import { getCurrentContext } from "@/lib/current-context";
import { getFinanceHistory, getFinanceSummary } from "@/modules/finance/server/queries";
import { FinanceExplorer } from "@/modules/finance/components/finance-explorer";
import { FigureEntry } from "@/modules/finance/components/figure-entry";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/utils";

export default async function FinancesPage() {
  const ctx = await getCurrentContext();
  requireModule(ctx, "finance");
  if (!ctx.can("finance.view")) redirect("/aujourdhui");

  const canManageFinance = ctx.can("finance.manage");
  const summary = await getFinanceSummary(ctx.establishment.id, 14);
  const history = await getFinanceHistory(ctx.establishment.id);
  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finances</h1>
        <p className="mt-1 text-sm text-muted-foreground">14 derniers jours</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">CA total</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(summary.totalRevenueCents)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Couverts</p>
          <p className="mt-1 text-xl font-semibold">{summary.totalCovers}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Panier moyen</p>
          <p className="mt-1 text-xl font-semibold">
            {summary.averageTicketCents != null ? formatCents(summary.averageTicketCents) : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Heures planifiées cette semaine</p>
          <p className="mt-1 text-xl font-semibold">{Math.round(summary.plannedHoursThisWeek * 10) / 10}h</p>
        </Card>
      </div>

      <FinanceExplorer
        title="Chiffre d'affaires"
        description="Compare les mois, les jours de la semaine ou les années. Coche les années à superposer."
        measures={[{ id: "revenue", label: "CA", kind: "cents", days: history.revenue.days, months: history.revenue.months }]}
      />

      <FinanceExplorer
        title="Réservations et couverts"
        description="Réservations réellement honorées (arrivées, installées ou terminées) et couverts servis — même lecture que le CA."
        measures={[
          { id: "reservations", label: "Réservations", kind: "count", days: history.reservations.days, months: history.reservations.months },
          { id: "covers", label: "Couverts", kind: "count", days: history.covers.days, months: history.covers.months },
        ]}
      />

      {canManageFinance && <FigureEntry initialYear={now.getFullYear()} initialMonth={now.getMonth() + 1} />}
    </div>
  );
}
