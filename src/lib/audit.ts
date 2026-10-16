import { prisma } from "@/lib/prisma";

/// Le journal des actions sensibles (qui a fait quoi, quand) : création et retrait d'un employé, changement de droits,
/// export ou suppression des données… Jamais bloquant : si l'écriture échoue, l'action elle-même continue.
export async function audit(
  ctx: { establishment: { id: string }; user: { id: string } },
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        establishmentId: ctx.establishment.id,
        userId: ctx.user.id,
        action,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (error) {
    console.error("Journal d'audit : écriture impossible", action, error);
  }
}
