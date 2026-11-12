import { prisma } from "@/lib/prisma";
import { SUPPORT_ROLE_KEY } from "@/lib/assistance";
import { requirePlatformAdmin } from "@/modules/admin/server/guard";

export type AdminEstablishment = {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  /// Le patron n'a pas encore choisi son mot de passe (l'invitation attend).
  ownerPending: boolean;
  members: number;
  reservationsLast30Days: number;
  onlineBookingEnabled: boolean;
  isDemo: boolean;
};

/// Tous les établissements, du plus récent au plus ancien, avec ce qu'il faut pour les accompagner d'un coup d'œil.
export async function getAdminEstablishments(): Promise<AdminEstablishment[]> {
  await requirePlatformAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.establishment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: { where: { role: { key: "OWNER" } }, include: { user: true }, take: 1, orderBy: { createdAt: "asc" } },
      _count: { select: { memberships: { where: { status: "active", role: { key: { not: SUPPORT_ROLE_KEY } } } } } },
    },
  });
  const counts = await prisma.reservation.groupBy({
    by: ["establishmentId"],
    where: { date: { gte: since } },
    _count: { _all: true },
  });
  const recent = new Map(counts.map((c) => [c.establishmentId, c._count._all]));

  return rows.map((e) => {
    const owner = e.memberships[0]?.user ?? null;
    return {
      id: e.id,
      name: e.name,
      type: e.type,
      createdAt: e.createdAt.toISOString(),
      ownerName: owner ? `${owner.firstName} ${owner.lastName}` : null,
      ownerEmail: owner?.email ?? null,
      ownerPending: !!owner && !owner.passwordHash,
      members: e._count.memberships,
      reservationsLast30Days: recent.get(e.id) ?? 0,
      onlineBookingEnabled: e.onlineBookingEnabled,
      isDemo: e.isDemo,
    };
  });
}
