import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/permissions";
import { checkRoleGrant } from "@/modules/staff/role-guard";

/// Résout un ensemble de droits vers un rôle exact ET réassigne la Membership dans la
/// foulée — les deux DOIVENT rester dans la même fonction : Membership.role est
/// `onDelete: Cascade` (schema.prisma), donc supprimer un rôle personnalisé devenu
/// orphelin AVANT que la Membership ait été réaffectée à un autre rôle supprimerait la
/// Membership elle-même avec lui. Si l'ensemble correspond exactement à `baseRoleId`
/// (rôle système choisi dans le sélecteur), on le réutilise tel quel — pas de rôle
/// personnalisé créé pour rien. Sinon, on réutilise le rôle personnalisé déjà propre à
/// cette personne s'il y en a un, pour ne jamais empiler un CUSTOM_* à chaque
/// modification ; sinon on en crée un.
export async function resolveAndAssignRole(
  establishmentId: string,
  membershipId: string,
  baseRoleId: string,
  permissionKeys: PermissionKey[]
): Promise<void> {
  const membership = await prisma.membership.findFirst({ where: { id: membershipId, establishmentId } });
  if (!membership) throw new Error("Employé introuvable.");
  const previousRoleId = membership.roleId;

  const baseRole = await prisma.role.findFirst({
    where: { id: baseRoleId, establishmentId },
    include: { permissions: { include: { permission: true } } },
  });
  if (!baseRole) throw new Error("Rôle introuvable.");

  const basePermissionKeys = new Set(baseRole.permissions.map((rp) => rp.permission.key as PermissionKey));
  const requestedKeys = new Set(permissionKeys);
  const matchesBase = basePermissionKeys.size === requestedKeys.size && [...basePermissionKeys].every((k) => requestedKeys.has(k));

  const resolvedRoleId = matchesBase
    ? baseRole.id
    : await createOrUpdateCustomRole(establishmentId, baseRole, permissionKeys, previousRoleId);

  // Réassigner d'abord — la Membership ne doit plus jamais pointer vers l'ancien rôle
  // au moment où on envisage de le supprimer, juste après.
  if (resolvedRoleId !== previousRoleId) {
    await prisma.membership.update({ where: { id: membershipId }, data: { roleId: resolvedRoleId } });
  }

  await cleanupOrphanCustomRole(establishmentId, previousRoleId, resolvedRoleId);
}

async function createOrUpdateCustomRole(
  establishmentId: string,
  baseRole: { id: string; label: string },
  permissionKeys: PermissionKey[],
  previousRoleId: string | null | undefined
): Promise<string> {
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
  const previousCustomRole = previousRoleId
    ? await prisma.role.findFirst({ where: { id: previousRoleId, establishmentId, isSystem: false } })
    : null;

  if (previousCustomRole) {
    await prisma.rolePermission.deleteMany({ where: { roleId: previousCustomRole.id } });
    await prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: previousCustomRole.id, permissionId: p.id })) });
    return previousCustomRole.id;
  }

  const customRole = await prisma.role.create({
    data: {
      establishmentId,
      key: `CUSTOM_${crypto.randomUUID().slice(0, 8)}`,
      label: `${baseRole.label} (personnalisé)`,
      isSystem: false,
    },
  });
  await prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: customRole.id, permissionId: p.id })) });
  return customRole.id;
}

/// Un rôle personnalisé n'existe que pour porter les droits d'UNE personne à la fois
/// dans ce produit (jamais partagé) — s'il ne sert plus (on vient de le quitter pour un
/// autre rôle), autant le supprimer plutôt que laisser un rôle orphelin polluer la
/// liste "Rôles & permissions" de /parametres. Appelée seulement APRÈS que la
/// Membership a été réaffectée (voir resolveAndAssignRole) — jamais avant, sous peine
/// de supprimer la Membership elle-même (onDelete: Cascade sur Membership.role).
async function cleanupOrphanCustomRole(establishmentId: string, previousRoleId: string | null | undefined, resolvedRoleId: string) {
  if (!previousRoleId || previousRoleId === resolvedRoleId) return;
  const role = await prisma.role.findFirst({
    where: { id: previousRoleId, establishmentId, isSystem: false },
    include: { _count: { select: { memberships: true } } },
  });
  if (role && role._count.memberships === 0) {
    await prisma.role.delete({ where: { id: role.id } });
  }
}

/// Vérifie, AVANT toute modification, que la personne qui agit a le droit de donner ce rôle et ces droits à cette personne
/// (voir staff/role-guard.ts). Lève une erreur lisible sinon.
export async function assertGrantable(
  ctx: { establishment: { id: string }; membership: { id: string; role: { key: string } }; permissions: ReadonlySet<string> },
  params: { targetMembershipId: string | null; baseRoleId: string; permissionKeys: readonly string[] }
): Promise<void> {
  const baseRole = await prisma.role.findFirst({
    where: { id: params.baseRoleId, establishmentId: ctx.establishment.id },
    include: { permissions: { include: { permission: true } } },
  });
  if (!baseRole) throw new Error("Rôle introuvable.");

  const target = params.targetMembershipId
    ? await prisma.membership.findFirst({
        where: { id: params.targetMembershipId, establishmentId: ctx.establishment.id },
        select: { id: true, role: { select: { key: true } } },
      })
    : null;
  if (params.targetMembershipId && !target) throw new Error("Employé introuvable.");

  const error = checkRoleGrant({
    actor: { permissions: ctx.permissions, isOwner: ctx.membership.role.key === "OWNER" },
    target: { currentRoleKey: target?.role.key ?? null, isSelf: target?.id === ctx.membership.id },
    next: {
      baseRoleKey: baseRole.key,
      resultingKeys: params.permissionKeys.length > 0 ? params.permissionKeys : baseRole.permissions.map((rp) => rp.permission.key),
    },
  });
  if (error) throw new Error(error);
}
