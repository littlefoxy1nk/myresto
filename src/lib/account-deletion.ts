import { prisma } from "@/lib/prisma";

/// Qui a le droit de fermer l'établissement : le propriétaire, et lui seul.
export function isOwner(ctx: { membership: { role: { key: string } } }): boolean {
  return ctx.membership.role.key === "OWNER";
}

/// Supprime DÉFINITIVEMENT un établissement et tout ce qui s'y rattache : réservations, clients, planning, équipe et leurs
/// comptes de connexion, finances, photos et documents (gardés dans la base : ils partent en cascade avec l'établissement). Rien n'est gardé, rien ne peut être récupéré.
/// Les comptes qui n'appartiennent à aucun autre établissement disparaissent avec lui ; l'entreprise aussi si elle est vide.
export async function deleteEstablishmentCompletely(establishmentId: string): Promise<{ users: number; files: number }> {
  const establishment = await prisma.establishment.findUnique({ where: { id: establishmentId }, select: { companyId: true } });
  if (!establishment) throw new Error("Établissement introuvable.");

  const [files, memberships] = await Promise.all([
    prisma.storedFile.count({ where: { establishmentId } }),
    prisma.membership.findMany({ where: { establishmentId }, select: { userId: true } }),
  ]);
  const userIds = [...new Set(memberships.map((m) => m.userId))];

  // Tout ce qui est rattaché à l'établissement part en cascade avec lui.
  await prisma.establishment.delete({ where: { id: establishmentId } });

  // Les comptes qui n'ont plus aucun établissement n'ont plus de raison d'exister.
  const orphans = await prisma.user.findMany({ where: { id: { in: userIds }, memberships: { none: {} } }, select: { id: true } });
  if (orphans.length > 0) await prisma.user.deleteMany({ where: { id: { in: orphans.map((u) => u.id) } } });

  const remaining = await prisma.establishment.count({ where: { companyId: establishment.companyId } });
  if (remaining === 0) await prisma.company.delete({ where: { id: establishment.companyId } }).catch(() => undefined);

  return { users: orphans.length, files };
}
