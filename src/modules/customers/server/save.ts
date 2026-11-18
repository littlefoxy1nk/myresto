import { prisma } from "@/lib/prisma";
import { findCustomer, splitName } from "@/modules/customers/server/matching";

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
    // Les réservations de cette même personne (même téléphone ou email) rejoignent sa fiche.
    await tx.reservation.updateMany({
      where: {
        establishmentId,
        customerId: null,
        OR: [phone ? { customerPhone: phone } : undefined, email ? { customerEmail: email } : undefined].filter((c): c is NonNullable<typeof c> => !!c),
      },
      data: { customerId },
    });
    return { customerId, created };
  });
}
