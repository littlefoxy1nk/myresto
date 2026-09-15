import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

type Tx = typeof prisma | Prisma.TransactionClient;

/// Relie une réservation à une fiche client existante ou en crée une, pour que
/// l'historique se construise automatiquement au fil des réservations plutôt que de
/// laisser le CRM être une liste déconnectée (voir Mission "CRM & cycle de réservation").
/// Le téléphone est la clé de rapprochement la plus fiable ; à défaut l'email. Sans les
/// deux, on ne peut pas rapprocher un client de façon fiable — la réservation reste
/// anonyme (customerId null) plutôt que de risquer de fusionner deux personnes différentes.
export async function findOrCreateCustomer(
  tx: Tx,
  establishmentId: string,
  input: { name: string; phone?: string | null; email?: string | null }
): Promise<string | null> {
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;
  if (!phone && !email) return null;

  const existing = await tx.customer.findFirst({
    where: {
      establishmentId,
      OR: [phone ? { phone } : undefined, email ? { email } : undefined].filter(
        (c): c is NonNullable<typeof c> => !!c
      ),
    },
  });
  if (existing) return existing.id;

  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  const created = await tx.customer.create({
    data: {
      establishmentId,
      firstName: firstName || input.name.trim(),
      lastName: rest.join(" ") || "",
      phone,
      email,
    },
  });
  return created.id;
}
