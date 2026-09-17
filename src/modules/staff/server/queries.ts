import { prisma } from "@/lib/prisma";
import { startOfDay, startOfWeek, endOfWeek } from "date-fns";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import type { EmployeeProfile } from "@/modules/staff/types";

function fullDayLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/// Fiche employé consultée par un manager (staff.view) — distincte de mon-espace
/// (myspace/server/queries.ts), qui sert la vue qu'un membre a de lui-même. Ici on
/// scope explicitement par establishmentId : un manager ne doit jamais pouvoir
/// consulter la fiche d'un membre d'un autre établissement en devinant un membershipId.
export async function getEmployeeProfile(membershipId: string): Promise<EmployeeProfile> {
  const ctx = await getCurrentContext();
  if (!ctx.can("staff.view")) throw new ForbiddenError("staff.view");

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, establishmentId: ctx.establishment.id },
    include: { user: true, role: true },
  });
  if (!membership) throw new Error("Employé introuvable.");

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const [shifts, timeOffRows, unavailableRows, serviceDefinitions, unavailableServiceRows] = await Promise.all([
    prisma.shift.findMany({
      where: { membershipId, date: { gte: weekStart, lte: weekEnd }, status: { not: "cancelled" } },
      include: { service: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.timeOffRequest.findMany({
      where: { membershipId },
      include: { documents: true },
      orderBy: { startDate: "desc" },
      take: 10,
    }),
    prisma.availability.findMany({
      where: { membershipId, kind: "unavailable", startTime: null, endTime: null, serviceId: null },
      select: { dayOfWeek: true },
    }),
    prisma.serviceDefinition.findMany({ where: { establishmentId: ctx.establishment.id } }),
    prisma.availability.findMany({
      where: { membershipId, kind: "unavailable", serviceId: { not: null } },
      select: { dayOfWeek: true, serviceId: true },
    }),
  ]);

  const weekShifts = shifts.map((s) => ({
    id: s.id,
    date: toDateKey(s.date),
    dateLabel: fullDayLabel(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    serviceName: s.service?.name ?? null,
  }));

  return {
    membershipId: membership.id,
    name: `${membership.user.firstName} ${membership.user.lastName}`,
    firstName: membership.user.firstName,
    lastName: membership.user.lastName,
    roleLabel: membership.role.label,
    jobTitle: membership.jobTitle,
    email: membership.user.email,
    username: membership.user.username,
    hasCode: membership.user.codeHash != null,
    phone: membership.user.phone,
    hiredAt: membership.hiredAt ? toDateKey(membership.hiredAt) : null,
    weeklyHoursTarget: membership.weeklyHoursTarget,
    skills: membership.skills,
    weekShifts,
    weekShiftsCount: weekShifts.length,
    timeOffRequests: timeOffRows.map((r) => ({
      id: r.id,
      startDate: toDateKey(r.startDate),
      endDate: toDateKey(r.endDate),
      reason: r.reason,
      status: r.status as "pending" | "approved" | "rejected",
      kind: r.kind as "conge" | "maladie",
      document: r.documents[0] ? { id: r.documents[0].id, originalName: r.documents[0].originalName } : null,
    })),
    unavailableDays: unavailableRows.map((r) => r.dayOfWeek),
    availabilityServices: serviceDefinitions.map((s) => ({ id: s.id, name: s.name, daysOfWeek: s.daysOfWeek.split(",").map(Number) })),
    unavailableServiceCells: unavailableServiceRows.map((r) => ({ dayOfWeek: r.dayOfWeek, serviceId: r.serviceId! })),
  };
}
