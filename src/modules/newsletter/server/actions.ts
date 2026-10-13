"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { normalizeReviewUrl } from "@/modules/newsletter/mail";

/// Liens "laisser un avis" du restaurant (Paramètres). Vide = lien retiré.
export async function updateReviewLinks(input: { google: string; tripadvisor: string }) {
  const ctx = await requirePermission("settings.manage");
  const google = normalizeReviewUrl(input.google);
  const tripadvisor = normalizeReviewUrl(input.tripadvisor);

  await prisma.establishment.update({
    where: { id: ctx.establishment.id },
    data: { googleReviewUrl: google, tripadvisorReviewUrl: tripadvisor },
  });
  revalidatePath("/parametres");
  revalidatePath("/clients");
}

/// Appelé quand le responsable ouvre le premier mail d'un client dans sa messagerie.
export async function markWelcomeMailSent(customerId: string) {
  const ctx = await requirePermission("crm.manage");
  const customer = await prisma.customer.findFirst({ where: { id: customerId, establishmentId: ctx.establishment.id } });
  if (!customer) throw new Error("Client introuvable.");
  await prisma.customer.update({ where: { id: customerId }, data: { welcomeMailSentAt: new Date() } });
  revalidatePath("/clients");
}

/// PUBLIC : le client se désinscrit via le lien secret de ses mails. Le secret est conservé
/// (le lien reste valable) ; seul l'accord est retiré.
export async function unsubscribeByToken(token: string): Promise<{ ok: boolean }> {
  if (!/^[a-f0-9]{32}$/.test(token)) return { ok: false };
  const customer = await prisma.customer.findUnique({ where: { unsubscribeToken: token } });
  if (!customer) return { ok: false };
  await prisma.customer.update({ where: { id: customer.id }, data: { newsletterConsent: false } });
  revalidatePath("/clients");
  return { ok: true };
}
