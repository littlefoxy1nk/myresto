import { prisma } from "@/lib/prisma";

/// Vide la base clients d'UN établissement (jamais d'un autre). Les réservations restent telles quelles — nom, téléphone, historique du
/// service — elles ne sont simplement plus rattachées à une fiche. Avec `keepNewsletter`, les inscrits à la newsletter sont conservés :
/// leur accord et leur lien de désinscription sont déjà dans des mails envoyés, on ne les efface pas par mégarde.
/// Sans vérification de droits : l'appelant s'en charge.
export async function eraseAllCustomers(establishmentId: string, keepNewsletter: boolean): Promise<{ deleted: number; keptSubscribers: number }> {
  const target = { establishmentId, ...(keepNewsletter ? { newsletterConsent: false } : {}) };
  const ids = (await prisma.customer.findMany({ where: target, select: { id: true } })).map((c) => c.id);

  if (ids.length > 0) {
    await prisma.$transaction([
      prisma.reservation.updateMany({ where: { establishmentId, customerId: { in: ids } }, data: { customerId: null } }),
      prisma.customer.deleteMany({ where: { establishmentId, id: { in: ids } } }),
    ]);
  }
  const keptSubscribers = keepNewsletter ? await prisma.customer.count({ where: { establishmentId, newsletterConsent: true } }) : 0;
  return { deleted: ids.length, keptSubscribers };
}
