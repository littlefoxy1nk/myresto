import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ensurePermissionCatalog } from "@/lib/provision-establishment";

/// Le « mode assistance » : une personne de l'équipe MYRESTO entre dans l'établissement d'un client avec un rôle d'assistance
/// (tous les droits de gestion, mais PAS propriétaire : ni suppression de l'établissement, ni export, ni accès au compte du
/// patron). Ce rôle est un vrai rôle de la base : tout le reste de l'appli fonctionne sans cas particulier.
export const SUPPORT_ROLE_KEY = "SUPPORT";
export const SUPPORT_ROLE_LABEL = "Assistance MYRESTO";

/// À ajouter dans les recherches de membres : l'assistance n'apparaît pas dans l'équipe, le planning, ni les listes de
/// remplaçants ou de destinataires de notifications.
export const NOT_SUPPORT = { role: { key: { not: SUPPORT_ROLE_KEY } } } as const;

const COOKIE = "myresto-assist";
const MAX_AGE_SECONDS = 8 * 60 * 60;

/// L'établissement choisi pour la session en cours (sans garantie : il est revérifié à chaque requête, voir current-context.ts).
export async function readAssistanceTarget(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function setAssistanceTarget(establishmentId: string): Promise<void> {
  (await cookies()).set(COOKIE, establishmentId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAssistanceTarget(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/// Donne à une personne de l'équipe MYRESTO son accès d'assistance à un établissement : crée le rôle d'assistance au besoin,
/// puis son adhésion. Si elle fait DÉJÀ partie de l'établissement (par exemple parce qu'elle en est la propriétaire),
/// on n'y touche pas : on ne rétrograde jamais un vrai rôle.
export async function ensureSupportMembership(userId: string, establishmentId: string): Promise<void> {
  const existing = await prisma.membership.findUnique({ where: { userId_establishmentId: { userId, establishmentId } }, select: { id: true } });
  if (existing) return;

  const permByKey = await ensurePermissionCatalog();
  const role = await prisma.role.upsert({
    where: { establishmentId_key: { establishmentId, key: SUPPORT_ROLE_KEY } },
    create: { establishmentId, key: SUPPORT_ROLE_KEY, label: SUPPORT_ROLE_LABEL, isSystem: true },
    update: {},
  });
  await prisma.rolePermission.createMany({
    data: [...permByKey.values()].map((perm) => ({ roleId: role.id, permissionId: perm.id })),
    skipDuplicates: true,
  });
  await prisma.membership.create({
    data: { userId, establishmentId, roleId: role.id, jobTitle: SUPPORT_ROLE_LABEL, status: "active" },
  });
}
