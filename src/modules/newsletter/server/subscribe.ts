import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

type Tx = typeof prisma | Prisma.TransactionClient;

/// Inscrit un client à la newsletter après son accord explicite (case cochée). Rapproche une
/// fiche existante (téléphone, puis email) ou en crée une, et enregistre l'accord avec sa date.
/// Un client déjà inscrit garde son secret de désinscription et sa date d'accord d'origine.
export async function subscribeCustomer(
  tx: Tx,
  establishmentId: string,
  input: { firstName: string; lastName: string; phone: string | null; email: string }
): Promise<string> {
  const existing = await tx.customer.findFirst({
    where: {
      establishmentId,
      OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])],
    },
  });

  const consent = {
    newsletterConsent: true,
    newsletterConsentAt: existing?.newsletterConsent ? existing.newsletterConsentAt : new Date(),
    unsubscribeToken: existing?.unsubscribeToken ?? randomBytes(16).toString("hex"),
  };

  if (existing) {
    await tx.customer.update({
      where: { id: existing.id },
      // On complète seulement ce qui manque : jamais d'écrasement de données déjà connues.
      data: { ...consent, email: existing.email ?? input.email, phone: existing.phone ?? input.phone },
    });
    return existing.id;
  }

  const created = await tx.customer.create({
    data: {
      establishmentId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      ...consent,
    },
  });
  return created.id;
}
