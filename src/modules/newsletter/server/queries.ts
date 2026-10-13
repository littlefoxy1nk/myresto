import { prisma } from "@/lib/prisma";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";

export type NewsletterRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  unsubscribeToken: string;
  welcomeMailSent: boolean;
};

/// Les clients qui ont dit oui à la newsletter ET ont un email : la seule liste à qui on écrit.
/// Réservé à la gestion des clients (elle contient le secret de désinscription de chaque lien).
export async function getNewsletterAudience(establishmentId: string): Promise<NewsletterRecipient[]> {
  const ctx = await getCurrentContext();
  if (!ctx.can("crm.manage")) throw new ForbiddenError("crm.manage");

  const customers = await prisma.customer.findMany({
    where: { establishmentId, newsletterConsent: true, email: { not: null }, unsubscribeToken: { not: null } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return customers.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email!,
    unsubscribeToken: c.unsubscribeToken!,
    welcomeMailSent: c.welcomeMailSentAt !== null,
  }));
}
