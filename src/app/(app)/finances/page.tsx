import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getFinanceSummary, getMissingClosingDates } from "@/modules/finance/server/queries";
import { MissingClosings } from "@/modules/finance/components/missing-closings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/utils";

const RATING_LABEL: Record<string, string> = { good: "Bon service", normal: "Service normal", bad: "Service difficile" };
const RATING_VARIANT: Record<string, "good" | "neutral" | "urgent"> = { good: "good", normal: "neutral", bad: "urgent" };

const ISSUE_LABEL: Record<string, string> = {
  kitchen: "Cuisine",
  floor: "Salle",
  understaffed: "Sous-staffé",
  wait: "Attente",
  difficult_customer: "Client difficile",
  stock: "Stock",
  other: "Autre",
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00`));
}

export default async function FinancesPage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("finance.view")) redirect("/aujourdhui");

  const canManageFinance = ctx.can("finance.manage");
  const summary = await getFinanceSummary(ctx.establishment.id, 14);
  const missingDates = canManageFinance ? await getMissingClosingDates(ctx.establishment.id, 14) : [];

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

      <Card>
        <CardHeader>
          <CardTitle>Main-d&apos;œuvre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-sm">
          <p>
            Coût de main-d&apos;œuvre : <span className="font-medium text-foreground">{formatCents(summary.totalLaborCostCents)}</span>
            {summary.laborCostRatio != null && (
              <>
                {" "}
                soit <span className="font-medium text-foreground">{Math.round(summary.laborCostRatio * 100)}%</span> du CA
              </>
            )}
          </p>
          <p>
            Marge après main-d&apos;œuvre : <span className="font-medium text-foreground">{formatCents(summary.marginAfterLaborCents)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Ne comprend pas le loyer, la matière première ni les autres charges — non suivis aujourd&apos;hui dans l&apos;application.
          </p>
        </CardContent>
      </Card>

      {canManageFinance && missingDates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Jours non clôturés</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-2 text-xs text-muted-foreground">
              Le CA de ces jours n&apos;a pas été renseigné — les totaux ci-dessus ne les incluent pas.
            </p>
            <MissingClosings dates={missingDates} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historique quotidien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-0">
          {[...summary.daily].reverse().map((d) => (
            <div key={d.date} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm odd:bg-muted/50">
              <span className="text-muted-foreground">{formatDate(d.date)}</span>
              <span className="flex gap-4">
                <span>{formatCents(d.revenueCents)}</span>
                <span className="w-16 text-right text-muted-foreground">{d.covers} couv.</span>
                <span className="w-24 text-right text-muted-foreground">{formatCents(d.laborCostCents)} MO</span>
              </span>
            </div>
          ))}
          {summary.daily.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune donnée sur cette période.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Services notés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {summary.recentReports.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {formatDate(r.date)} · {r.serviceLabel}
                  {r.covers != null && ` · ${r.covers} couverts`}
                </span>
                <Badge variant={RATING_VARIANT[r.rating] ?? "neutral"}>{RATING_LABEL[r.rating] ?? r.rating}</Badge>
              </div>
              {r.issues.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.issues.map((i) => (
                    <Badge key={i} variant="neutral">
                      {ISSUE_LABEL[i] ?? i}
                    </Badge>
                  ))}
                </div>
              )}
              {r.note && <p className="mt-1.5 text-xs text-muted-foreground">{r.note}</p>}
            </div>
          ))}
          {summary.recentReports.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun service noté pour le moment.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
