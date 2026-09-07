import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/permissions";

/// Contexte "utilisateur connecté + établissement actif" utilisé par toutes les pages
/// et Server Actions. Pour la V1, un utilisateur opère sur son premier établissement actif
/// (multi-établissement viendra sélectionner explicitement establishmentId ici).
export async function getCurrentContext() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: "active" },
    include: {
      user: true,
      establishment: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) redirect("/onboarding");

  const permissions = new Set(
    membership.role.permissions.map((rp) => rp.permission.key as PermissionKey)
  );

  return {
    user: membership.user,
    establishment: membership.establishment,
    membership,
    permissions,
    can: (permission: PermissionKey) => permissions.has(permission),
  };
}

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Permission manquante : ${permission}`);
  }
}

/// Garde à utiliser en tête de chaque Server Action mutante. Ne jamais s'appuyer
/// uniquement sur le masquage UI côté client pour protéger une action.
export async function requirePermission(permission: PermissionKey) {
  const ctx = await getCurrentContext();
  if (!ctx.can(permission)) {
    throw new ForbiddenError(permission);
  }
  return ctx;
}

/// Variante "au moins une de ces permissions" — utile quand une action opérationnelle
/// (ex: marquer un client arrivé) doit rester accessible au personnel de salle
/// (service.run) sans exiger les droits de configuration complets (reservations.edit).
export async function requireAnyPermission(...permissions: PermissionKey[]) {
  const ctx = await getCurrentContext();
  if (!permissions.some((p) => ctx.can(p))) {
    throw new ForbiddenError(permissions.join(" ou "));
  }
  return ctx;
}
