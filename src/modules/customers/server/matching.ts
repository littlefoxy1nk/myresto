import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

type Tx = typeof prisma | Prisma.TransactionClient;

/// La fiche d'un client DÉJÀ enregistré qui correspond à ce téléphone ou cet email, sinon null. Ne crée JAMAIS de fiche : la base
/// clients ne contient que les personnes que le restaurateur a choisi d'enregistrer, ou qui se sont inscrites à la newsletter.
/// Une réservation d'un client enregistré se relie à sa fiche (son historique se construit) ; les autres restent anonymes.
/// Le téléphone est la clé de rapprochement la plus fiable ; à défaut l'email. Sans les deux, aucun rapprochement.
export async function findCustomer(
  tx: Tx,
  establishmentId: string,
  input: { phone?: string | null; email?: string | null }
): Promise<string | null> {
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;
  if (!phone && !email) return null;

  const existing = await tx.customer.findFirst({
    where: {
      establishmentId,
      OR: [phone ? { phone } : undefined, email ? { email } : undefined].filter((c): c is NonNullable<typeof c> => !!c),
    },
    select: { id: true },
  });
  return existing?.id ?? null;
}

/// « Marie Dupont » → prénom « Marie », nom « Dupont » (le reste du nom va dans le nom de famille).
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName: firstName || fullName.trim(), lastName: rest.join(" ") };
}
