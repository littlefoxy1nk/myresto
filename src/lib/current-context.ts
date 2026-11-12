import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/permissions";
import { NOT_SUPPORT, SUPPORT_ROLE_KEY, readAssistanceTarget } from "@/lib/assistance";
import { isPlatformAdminEmail } from "@/lib/platform-admin";

/// Contexte "utilisateur connecté + établissement actif" utilisé par toutes les pages
/// et Server Actions. Par défaut, la personne opère sur son premier établissement actif. Une personne de l'équipe MYRESTO
/// peut en plus entrer dans l'établissement d'un client (« mode assistance », voir lib/assistance.ts) : elle y agit avec
/// le rôle d'assistance, jamais en propriétaire.
///
/// Calculé UNE seule fois par requête (`cache`) : une page appelle ce contexte depuis son layout, sa page et chacune de ses
/// requêtes ; sans cela, chaque appel refaisait six lectures en base pour obtenir exactement le même résultat.
export const getCurrentContext = cache(loadContext);

async function loadContext() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const include = {
    user: true,
    establishment: true,
    role: { include: { permissions: { include: { permission: true } } } },
  } as const;

  let membership = null;
  const targetId = await readAssistanceTarget();
  if (targetId) {
    const candidate = await prisma.membership.findFirst({
      where: { userId: session.user.id, establishmentId: targetId, status: "active" },
      include,
    });
    // L'accès d'assistance n'est valable que tant que l'adresse est dans la liste de l'équipe MYRESTO : la retirer de la
    // liste coupe l'accès à la requête suivante.
    if (candidate && (candidate.role.key !== SUPPORT_ROLE_KEY || isPlatformAdminEmail(candidate.user.email))) membership = candidate;
  }
  if (!membership) {
    // Sans choix particulier : le premier établissement dont la personne fait vraiment partie (jamais un accès d'assistance).
    membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, status: "active", ...NOT_SUPPORT },
      include,
      orderBy: { createdAt: "asc" },
    });
  }

  if (!membership) redirect("/onboarding");

  // Une session ouverte avant un changement de mot de passe / de code n'est plus valable.
  if (membership.user.sessionVersion !== ((session as { sv?: number }).sv ?? 0)) redirect("/login");

  const permissions = new Set(
    membership.role.permissions.map((rp) => rp.permission.key as PermissionKey)
  );

  return {
    user: membership.user,
    establishment: membership.establishment,
    membership,
    permissions,
    /// Vrai quand une personne de l'équipe MYRESTO est entrée chez un client en mode assistance.
    assistance: membership.role.key === SUPPORT_ROLE_KEY,
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
