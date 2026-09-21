import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import type { TimeOffRequestItem, TimeOffStatus } from "@/modules/timeoff/types";

const STATUS_RANK: Record<TimeOffStatus, number> = { pending: 0, approved: 1, rejected: 2 };

/// Congés & absences V1 : lecture et décision (accepter/refuser), pas de dépôt de
/// demande depuis cet écran (hors scope, voir Mission 6). Réservé à qui valide les
/// congés — timeoff.manage couvre déjà lecture ET décision, pas besoin d'une
/// permission "view" séparée pour un écran purement administratif.
export async function getTimeOffRequests(establishmentId: string): Promise<{ requests: TimeOffRequestItem[]; canManage: boolean }> {
  const ctx = await getCurrentContext();
  if (!ctx.can("timeoff.manage")) throw new ForbiddenError("timeoff.manage");

  const rows = await prisma.timeOffRequest.findMany({
    where: { establishmentId, membership: { status: "active" } },
    include: { membership: { include: { user: true } }, documents: true },
    orderBy: [{ startDate: "desc" }],
  });

  const requests: TimeOffRequestItem[] = rows
    .map((r) => ({
      id: r.id,
      membershipId: r.membershipId,
      memberName: `${r.membership.user.firstName} ${r.membership.user.lastName}`,
      jobTitle: r.membership.jobTitle,
      startDate: format(r.startDate, "yyyy-MM-dd"),
      endDate: format(r.endDate, "yyyy-MM-dd"),
      reason: r.reason,
      status: r.status as TimeOffStatus,
      kind: r.kind as TimeOffRequestItem["kind"],
      document: r.documents[0] ? { id: r.documents[0].id, originalName: r.documents[0].originalName } : null,
    }))
    // en attente d'abord (ce qui demande une action), puis par statut, la date de
    // tri primaire (startDate desc) étant déjà appliquée en base.
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  return { requests, canManage: ctx.can("timeoff.manage") };
}
