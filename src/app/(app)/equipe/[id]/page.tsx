import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getEmployeeProfile } from "@/modules/staff/server/queries";
import { RegenerateCodeButton } from "@/modules/staff/components/regenerate-code-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

const TIMEOFF_STATUS_LABEL: Record<string, string> = { pending: "En attente", approved: "Acceptée", rejected: "Refusée" };
const TIMEOFF_STATUS_VARIANT: Record<string, "watch" | "good" | "neutral"> = {
  pending: "watch",
  approved: "good",
  rejected: "neutral",
};

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
];

function formatPeriod(startDate: string, endDate: string) {
  const format = (d: string) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00`));
  return startDate === endDate ? format(startDate) : `${format(startDate)} – ${format(endDate)}`;
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentContext();
  if (!ctx.can("staff.view")) redirect("/aujourdhui");

  const profile = await getEmployeeProfile(id);
  const canManage = ctx.can("staff.manage");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="-ml-2">
          <Link href="/equipe">
            <ArrowLeft size={15} aria-hidden="true" />
            Équipe
          </Link>
        </Button>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.jobTitle ?? profile.roleLabel}
              {profile.jobTitle && profile.jobTitle !== profile.roleLabel ? ` · ${profile.roleLabel}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Informations */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Informations</h2>
        <Card className="space-y-2 p-4 text-sm">
          {profile.email && (
            <p>
              Email : <span className="font-medium">{profile.email}</span>
            </p>
          )}
          {profile.username && (
            <p>
              Identifiant : <span className="font-medium">{profile.username}</span>
            </p>
          )}
          {profile.phone && (
            <p>
              Téléphone : <span className="font-medium">{profile.phone}</span>
            </p>
          )}
          {profile.hiredAt && (
            <p className="text-muted-foreground">
              Arrivée le {new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${profile.hiredAt}T00:00:00`))}
            </p>
          )}
          {profile.weeklyHoursTarget != null && (
            <p className="text-muted-foreground">Objectif : {profile.weeklyHoursTarget}h / semaine</p>
          )}
          {profile.skills && <p className="text-muted-foreground">Compétences : {profile.skills}</p>}
          {canManage && profile.hasCode && (
            <div className="pt-2">
              <RegenerateCodeButton membershipId={profile.membershipId} name={profile.firstName} />
            </div>
          )}
        </Card>
      </section>

      {/* Planning */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Planning cette semaine</h2>
        {profile.weekShifts.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucun service planifié cette semaine.</Card>
        ) : (
          <div className="space-y-2">
            {profile.weekShifts.map((s) => (
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

      {/* Absences */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Congés & absences</h2>
        {profile.timeOffRequests.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucune demande pour le moment.</Card>
        ) : (
          <div className="space-y-2">
            {profile.timeOffRequests.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="text-sm">{formatPeriod(r.startDate, r.endDate)}</span>
                {r.kind === "maladie" && <Badge variant="urgent">Maladie</Badge>}
                <Badge variant={TIMEOFF_STATUS_VARIANT[r.status]}>{TIMEOFF_STATUS_LABEL[r.status]}</Badge>
                {r.reason && <span className="text-xs text-muted-foreground">· {r.reason}</span>}
                {r.document && (
                  <a
                    href={`/api/employee-documents/${r.document.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <FileText size={13} aria-hidden="true" />
                    Certificat
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Disponibilités */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Indisponibilités habituelles</h2>
        {profile.availabilityServices.length > 0 ? (
          profile.unavailableServiceCells.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">Aucune indisponibilité déclarée.</Card>
          ) : (
            <div className="space-y-1.5">
              {DAYS.map((d) => {
                const servicesToday = profile.availabilityServices.filter((s) => s.daysOfWeek.includes(d.value));
                const unavailableToday = servicesToday.filter((s) =>
                  profile.unavailableServiceCells.some((c) => c.dayOfWeek === d.value && c.serviceId === s.id)
                );
                if (unavailableToday.length === 0) return null;
                return (
                  <div key={d.value} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-9 shrink-0 text-xs font-medium text-muted-foreground">{d.label}</span>
                    {unavailableToday.map((s) => (
                      <Badge key={s.id} variant="urgent">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                );
              })}
            </div>
          )
        ) : profile.unavailableDays.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">Aucune indisponibilité déclarée.</Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            {DAYS.filter((d) => profile.unavailableDays.includes(d.value)).map((d) => (
              <Badge key={d.value} variant="urgent">
                {d.label}
              </Badge>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
