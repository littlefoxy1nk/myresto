import { getCurrentContext } from "@/lib/current-context";
import { getMyDashboard } from "@/modules/myspace/server/queries";
import { RequestTimeOffButton } from "@/modules/myspace/components/request-timeoff-button";
import { ChangeCodeButton } from "@/modules/myspace/components/change-code-button";
import { AvailabilityToggles } from "@/modules/myspace/components/availability-toggles";
import { NotificationsList } from "@/modules/myspace/components/notifications-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CalendarDays } from "lucide-react";

const TIMEOFF_STATUS_LABEL: Record<string, string> = { pending: "En attente", approved: "Acceptée", rejected: "Refusée" };
const TIMEOFF_STATUS_VARIANT: Record<string, "watch" | "good" | "neutral"> = {
  pending: "watch",
  approved: "good",
  rejected: "neutral",
};

function formatPeriod(startDate: string, endDate: string) {
  const format = (d: string) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00`));
  return startDate === endDate ? format(startDate) : `${format(startDate)} – ${format(endDate)}`;
}

export default async function MonEspacePage() {
  const ctx = await getCurrentContext();
  const data = await getMyDashboard();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {data.firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ctx.establishment.name}
          {data.jobTitle ? ` · ${data.jobTitle}` : ""}
        </p>
      </div>

      {/* Aujourd'hui — la première chose qu'on veut savoir en ouvrant son espace. */}
      <Card className="border-accent/25 bg-accent-soft/40 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
          <Clock size={13} aria-hidden="true" />
          Aujourd&apos;hui
        </div>
        {data.todayShifts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Pas de service prévu aujourd&apos;hui.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {data.todayShifts.map((s) => (
              <p key={s.id} className="text-lg font-semibold">
                {s.startTime} → {s.endTime}
                {s.serviceName && <span className="ml-2 text-sm font-normal text-muted-foreground">{s.serviceName}</span>}
              </p>
            ))}
          </div>
        )}
      </Card>

      {/* Cette semaine */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Services cette semaine</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tracking-tight">{data.weekShiftsCount}</p>
          </CardContent>
        </Card>
        {data.objective && (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle>Objectif de services</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold tracking-tight">
                {data.objective.planned}/{data.objective.target}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mon planning */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarDays size={16} aria-hidden="true" />
          Mon planning cette semaine
        </h2>
        {data.weekShifts.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucun service planifié cette semaine.</Card>
        ) : (
          <div className="space-y-2">
            {data.weekShifts.map((s) => (
              <Card key={s.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">{s.dateLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.startTime}–{s.endTime}
                    {s.serviceName ? ` · ${s.serviceName}` : ""}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Mes congés */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Mes congés</h2>
          <RequestTimeOffButton />
        </div>
        {data.timeOffRequests.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucune demande de congé pour le moment.</Card>
        ) : (
          <div className="space-y-2">
            {data.timeOffRequests.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="text-sm">{formatPeriod(r.startDate, r.endDate)}</span>
                <Badge variant={TIMEOFF_STATUS_VARIANT[r.status]}>{TIMEOFF_STATUS_LABEL[r.status]}</Badge>
                {r.reason && <span className="text-xs text-muted-foreground">· {r.reason}</span>}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Mes disponibilités */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Mes indisponibilités habituelles</h2>
        <p className="text-sm text-muted-foreground">
          Marquez les jours où vous n&apos;êtes jamais disponible. MYRESTO en tient compte pour vos objectifs de
          services.
        </p>
        <AvailabilityToggles initialUnavailableDays={data.unavailableDays} />
      </section>

      {/* Notifications */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Notifications</h2>
        <NotificationsList notifications={data.notifications} />
      </section>

      {/* Mon profil */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Mon profil</h2>
        <Card className="space-y-2 p-4 text-sm">
          {data.username && (
            <p>
              Identifiant : <span className="font-medium">{data.username}</span>
            </p>
          )}
          {data.hasEmail && <p className="text-muted-foreground">Un email est associé à ce compte.</p>}
          {data.hasCode && (
            <div className="pt-1">
              <ChangeCodeButton />
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
