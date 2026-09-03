import { prisma } from "@/lib/prisma";
import { PERMISSIONS, SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS } from "@/lib/permissions";

/// S'assure que le catalogue de permissions (fixe, défini par le code) existe en base.
/// Idempotent — sûr à appeler à chaque provisioning.
export async function ensurePermissionCatalog() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: {}, create: p });
  }
  const all = await prisma.permission.findMany();
  return new Map(all.map((p) => [p.key, p]));
}

/// Crée les rôles système d'un nouvel établissement avec leur matrice de permissions
/// par défaut (voir DEFAULT_ROLE_PERMISSIONS). Utilisé aussi bien par l'onboarding que
/// par le seed de démo — une seule source de vérité pour ne pas laisser les deux diverger.
export async function provisionSystemRoles(establishmentId: string) {
  const permByKey = await ensurePermissionCatalog();
  const roleIdByKey = new Map<string, string>();

  for (const key of SYSTEM_ROLES) {
    const role = await prisma.role.create({
      data: { establishmentId, key, label: ROLE_LABELS[key], isSystem: true },
    });
    roleIdByKey.set(key, role.id);
    for (const permKey of DEFAULT_ROLE_PERMISSIONS[key]) {
      const perm = permByKey.get(permKey);
      if (!perm) continue;
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    }
  }

  return roleIdByKey;
}
