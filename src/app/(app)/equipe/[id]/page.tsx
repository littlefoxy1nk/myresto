import { CalendarDays, Palmtree } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarFigure } from "@/components/ui/avatar-figure";
import { parseAvatar } from "@/lib/avatar";
import Link from "next/link";
import { requireModule } from "@/lib/module-guard";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { getEmployeeProfile } from "@/modules/staff/server/queries";
import { RegenerateCodeButton } from "@/modules/staff/components/regenerate-code-button";
import { EmployeeScheduleGrid } from "@/modules/staff/components/employee-schedule-grid";
import { EmploymentTypeSelect } from "@/modules/staff/components/employment-type-select";
import { EditEmployeeButton } from "@/modules/staff/components/edit-employee-dialog";
import { RemoveEmployeeButton } from "@/modules/staff/components/remove-employee-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { formatDateRange } from "@/lib/utils";

const TIMEOFF_STATUS_LABEL: Record<string, string> = { pending: "En attente", approved: "Acceptée", rejected: "Refusée" };
const TIMEOFF_STATUS_VARIANT: Record<string, "watch" | "good" | "neutral"> = {
  pending: "watch",
  approved: "good",
  rejected: "neutral",
};

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentContext();
  requireModule(ctx, "staff");
  if (!ctx.can("staff.view")) redirect("/aujourdhui");

  const profile = await getEmployeeProfile(id);
  const avatarUser = (
    await prisma.membership.findFirst({
      where: { id, establishmentId: ctx.establishment.id },
      select: { user: { select: { id: true, avatarJson: true } } },
    })
  )?.user;
  const canManage = ctx.can("staff.manage");

  const roles = canManage
    ? await prisma.role.findMany({
        where: { establishmentId: ctx.establishment.id, isSystem: true },
        include: { permissions: { include: { permission: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div className="stagger mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost" className="-ml-2">
          <Link href="/equipe">
            <ArrowLeft size={15} aria-hidden="true" />
            Équipe
          </Link>
        </Button>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <AvatarFigure config={parseAvatar(avatarUser?.avatarJson, avatarUser?.id ?? id)} size={64} />
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">{profile.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.jobTitle ?? profile.roleLabel}
                {profile.jobTitle && profile.jobTitle !== profile.roleLabel ? ` · ${profile.roleLabel}` : ""}
              </p>
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 items-start gap-2">
              <EditEmployeeButton
                membershipId={profile.membershipId}
                initial={{
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  phone: profile.phone,
                  jobTitle: profile.jobTitle,
                  weeklyHoursTarget: profile.weeklyHoursTarget,
                  skills: profile.skills,
                  roleId: profile.roleId,
                  roleIsSystem: profile.roleIsSystem,
                  currentPermissions: profile.currentPermissions,
                }}
                roles={roles.map((r) => ({ id: r.id, label: r.label, permissions: r.permissions.map((rp) => rp.permission.key) }))}
              />
              {profile.membershipId !== ctx.membership.id && (
                <RemoveEmployeeButton membershipId={profile.membershipId} name={profile.firstName} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Informations */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Informations</h2>
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
          {canManage ? (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-muted-foreground">Type de contrat :</span>
              <EmploymentTypeSelect membershipId={profile.membershipId} initialValue={profile.employmentType} />
            </div>
          ) : (
            <p className="text-muted-foreground">Type de contrat : {profile.employmentType === "flexijob" ? "Flexijob" : "Fixe"}</p>
          )}
          {canManage && profile.hasCode && (
            <div className="pt-2">
              <RegenerateCodeButton membershipId={profile.membershipId} name={profile.firstName} />
            </div>
          )}
        </Card>
      </section>

      {/* Planning */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Planning cette semaine</h2>
        {profile.weekShifts.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Aucun service planifié cette semaine" />
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
        <h2 className="text-lg font-bold tracking-tight">Congés & absences</h2>
        {profile.timeOffRequests.length === 0 ? (
          <EmptyState icon={Palmtree} title="Aucune demande pour le moment" />
        ) : (
          <div className="space-y-2">
            {profile.timeOffRequests.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="text-sm">{formatDateRange(r.startDate, r.endDate)}</span>
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

      {/* Horaire habituel */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Horaire habituel</h2>
        <p className="text-sm text-muted-foreground">
          {profile.employmentType === "flexijob"
            ? "Statut flexijob : cette personne déclare elle-même son horaire habituel depuis son espace, à tout moment."
            : "Les jours et services où cette personne travaille habituellement."}
        </p>
        {profile.availabilityServices.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">Aucun service n&apos;est configuré pour cet établissement.</Card>
        ) : (
          <EmployeeScheduleGrid
            membershipId={profile.membershipId}
            employmentType={profile.employmentType}
            canEdit={canManage && profile.employmentType === "fixe"}
            services={profile.availabilityServices}
            initialCells={profile.usualAvailabilityCells}
          />
        )}
      </section>

      {profile.oneOffAvailability.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Disponibilités en plus cette semaine</h2>
          <div className="flex flex-wrap gap-2">
            {profile.oneOffAvailability.map((entry) => {
              const service = profile.availabilityServices.find((s) => s.id === entry.serviceId);
              const label = new Intl.DateTimeFormat("fr-BE", { weekday: "short", day: "numeric", month: "short" }).format(
                new Date(`${entry.date}T00:00:00`)
              );
              return (
                <Badge key={`${entry.date}-${entry.serviceId}`} variant="accent">
                  {label} · {service?.name ?? entry.serviceId}
                </Badge>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
