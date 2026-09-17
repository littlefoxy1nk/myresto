import { prisma } from "@/lib/prisma";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { shiftsOverlap } from "@/modules/planning/compute";
import { isEligibleCandidate } from "@/modules/replacement/compute";
import type { EligibleCandidate, MyReplacementOpportunity, ReplacementRequestItem } from "@/modules/replacement/types";

function fullDayLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type ShiftForEligibility = { id: string; date: Date; startTime: string; endTime: string; position: string; membershipId: string };

/// Liste factuelle des personnes qui pourraient reprendre ce shift : poste/compétences
/// compatibles (isEligibleCandidate), pas déjà occupées ce jour-là (shiftsOverlap,
/// réutilisé tel quel depuis planning/compute.ts), pas en congé approuvé ce jour. Jamais
/// un classement — l'ordre de retour n'a aucune signification.
export async function getEligibleCandidatesForShift(
  establishmentId: string,
  shift: ShiftForEligibility
): Promise<Omit<EligibleCandidate, "hasVolunteered">[]> {
  const [members, dayShifts, approvedLeaves] = await Promise.all([
    prisma.membership.findMany({
      where: { establishmentId, status: "active", id: { not: shift.membershipId } },
      include: { user: true },
    }),
    prisma.shift.findMany({
      where: { establishmentId, date: shift.date, status: { not: "cancelled" }, id: { not: shift.id } },
    }),
    prisma.timeOffRequest.findMany({
      where: { establishmentId, status: "approved", startDate: { lte: shift.date }, endDate: { gte: shift.date } },
    }),
  ]);

  const onApprovedLeave = new Set(approvedLeaves.map((l) => l.membershipId));

  return members
    .filter((m) => {
      const hasOverlappingShift = dayShifts.some((s) => s.membershipId === m.id && shiftsOverlap(s, shift));
      const skills = (m.skills ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return isEligibleCandidate(
        { membershipId: m.id, skills, hasApprovedLeaveOnDate: onApprovedLeave.has(m.id), hasOverlappingShift },
        shift.position
      );
    })
    .map((m) => ({ membershipId: m.id, firstName: m.user.firstName, lastName: m.user.lastName }));
}

/// Vue manager : chaque remplacement ouvert avec la liste factuelle des candidats
/// éligibles et qui, parmi eux, s'est déjà proposé. Le manager choisit toujours qui
/// prend le shift, y compris parmi les éligibles qui n'ont pas (encore) été volontaires.
export async function getReplacementRequests(establishmentId: string): Promise<ReplacementRequestItem[]> {
  const ctx = await getCurrentContext();
  if (!ctx.can("schedule.edit")) throw new ForbiddenError("schedule.edit");

  const requests = await prisma.replacementRequest.findMany({
    where: { establishmentId, status: "open" },
    include: { shift: true, requestedBy: { include: { user: true } }, volunteers: true },
    orderBy: { createdAt: "desc" },
  });

  const items: ReplacementRequestItem[] = [];
  for (const r of requests) {
    const candidates = await getEligibleCandidatesForShift(establishmentId, r.shift);
    const volunteerIds = new Set(r.volunteers.map((v) => v.membershipId));
    items.push({
      id: r.id,
      shiftId: r.shiftId,
      status: r.status as "open" | "resolved",
      requestedByMembershipId: r.requestedById,
      requestedByName: `${r.requestedBy.user.firstName} ${r.requestedBy.user.lastName}`,
      date: toDateKey(r.shift.date),
      dateLabel: fullDayLabel(r.shift.date),
      startTime: r.shift.startTime,
      endTime: r.shift.endTime,
      position: r.shift.position,
      reason: r.reason,
      candidates: candidates.map((c) => ({ ...c, hasVolunteered: volunteerIds.has(c.membershipId) })),
      resolvedMembershipId: r.resolvedMembershipId,
    });
  }
  return items;
}

/// Vue employé : les remplacements ouverts, ailleurs que sur ses propres shifts, pour
/// lesquels il/elle fait factuellement partie des candidats éligibles.
export async function getMyReplacementOpportunities(): Promise<MyReplacementOpportunity[]> {
  const ctx = await getCurrentContext();

  const requests = await prisma.replacementRequest.findMany({
    where: { establishmentId: ctx.establishment.id, status: "open", requestedById: { not: ctx.membership.id } },
    include: { shift: true, requestedBy: { include: { user: true } }, volunteers: true },
    orderBy: { createdAt: "desc" },
  });

  const opportunities: MyReplacementOpportunity[] = [];
  for (const r of requests) {
    const candidates = await getEligibleCandidatesForShift(ctx.establishment.id, r.shift);
    if (!candidates.some((c) => c.membershipId === ctx.membership.id)) continue;
    opportunities.push({
      requestId: r.id,
      date: toDateKey(r.shift.date),
      dateLabel: fullDayLabel(r.shift.date),
      startTime: r.shift.startTime,
      endTime: r.shift.endTime,
      position: r.shift.position,
      requestedByName: `${r.requestedBy.user.firstName} ${r.requestedBy.user.lastName}`,
      hasVolunteered: r.volunteers.some((v) => v.membershipId === ctx.membership.id),
    });
  }
  return opportunities;
}
