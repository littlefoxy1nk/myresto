import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { findCustomer, splitName } from "@/modules/customers/server/matching";

type Tx = typeof prisma | Prisma.TransactionClient;

/// Les réservations de cette même personne (même téléphone ou email) qui n'avaient pas de fiche rejoignent la sienne : son historique apparaît.
async function linkOrphanReservations(tx: Tx, establishmentId: string, customerId: string, phone: string | null, email: string | null) {
  await tx.reservation.updateMany({
    where: {
      establishmentId,
      customerId: null,
      OR: [phone ? { customerPhone: phone } : undefined, email ? { customerEmail: email } : undefined].filter((c): c is NonNullable<typeof c> => !!c),
    },
    data: { customerId },
  });
}

/// Crée la fiche client d'une réservation (ou retrouve celle qui existe avec ce téléphone ou cet email) et y relie toutes les
/// réservations de cette personne. Sans vérification de droits : l'appelant s'en charge. Renvoie null si la réservation est introuvable.
export async function saveCustomerFromReservation(establishmentId: string, reservationId: string) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, establishmentId },
    select: { customerName: true, customerPhone: true, customerEmail: true },
  });
  if (!reservation) return null;

  const phone = reservation.customerPhone?.trim() || null;
  const email = reservation.customerEmail?.trim() || null;
  if (!phone && !email) throw new Error("Sans téléphone ni email, ce client ne peut pas être enregistré.");

  return prisma.$transaction(async (tx) => {
    let customerId = await findCustomer(tx, establishmentId, { phone, email });
    const created = !customerId;
    if (!customerId) {
      const { firstName, lastName } = splitName(reservation.customerName);
      customerId = (await tx.customer.create({ data: { establishmentId, firstName, lastName, phone, email } })).id;
    }
    await linkOrphanReservations(tx, establishmentId, customerId, phone, email);
    return { customerId, created };
  });
}

/// Ajoute un client à la main. Refuse un doublon (même téléphone ou même email qu'une fiche existante). Les réservations déjà faites
/// avec ce téléphone ou cet email rejoignent sa fiche. Sans vérification de droits : l'appelant s'en charge.
export async function createCustomerByHand(
  establishmentId: string,
  input: { firstName: string; lastName: string; phone: string | null; email: string | null }
): Promise<{ customerId: string }> {
  return prisma.$transaction(async (tx) => {
    if (await findCustomer(tx, establishmentId, input)) throw new Error("Un client avec ce téléphone ou cet email existe déjà.");
    const created = await tx.customer.create({ data: { establishmentId, ...input } });
    await linkOrphanReservations(tx, establishmentId, created.id, input.phone, input.email);
    return { customerId: created.id };
  });
}
