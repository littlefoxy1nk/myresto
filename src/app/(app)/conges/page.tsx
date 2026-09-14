import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getTimeOffRequests } from "@/modules/timeoff/server/queries";
import { TimeOffActionButton } from "@/modules/timeoff/components/timeoff-action-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Acceptée",
  rejected: "Refusée",
};

const STATUS_VARIANT: Record<string, "watch" | "good" | "neutral"> = {
  pending: "watch",
  approved: "good",
  rejected: "neutral",
};

function formatPeriod(startDate: string, endDate: string) {
  const format = (d: string) =>
    new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00`));
  return startDate === endDate ? format(startDate) : `${format(startDate)} – ${format(endDate)}`;
}

export default async function CongesPage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("timeoff.manage")) redirect("/aujourdhui");

  const { requests, canManage } = await getTimeOffRequests(ctx.establishment.id);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Congés</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {requests.length} demande{requests.length > 1 ? "s" : ""}
          {pendingCount > 0 ? ` · ${pendingCount} en attente` : ""}
        </p>
      </div>

      <div className="space-y-2">
        {requests.map((r) => (
          <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="sm:w-44 sm:shrink-0">
              <p className="text-sm font-medium">{r.memberName}</p>
              {r.jobTitle && <p className="text-xs text-muted-foreground">{r.jobTitle}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:flex-1">
              <span className="text-sm">{formatPeriod(r.startDate, r.endDate)}</span>
              <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              {r.reason && <span className="text-xs text-muted-foreground">· {r.reason}</span>}
            </div>

            {canManage && r.status === "pending" && (
              <div className="flex gap-2">
                <TimeOffActionButton requestId={r.id} action="approve" />
                <TimeOffActionButton requestId={r.id} action="reject" />
              </div>
            )}
          </Card>
        ))}
        {requests.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucune demande de congé pour le moment.</Card>
        )}
      </div>
    </div>
  );
}
