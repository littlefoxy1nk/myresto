"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/current-context";
import { createRateLimiter } from "@/modules/booking/logic";
import { sendPushToMember, vapidConfig } from "@/modules/push/server/send";

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "Adresse de notification invalide."),
  p256dh: z.string().min(10).max(300),
  auth: z.string().min(10).max(100),
  userAgent: z.string().max(300).optional(),
});

/// La clé publique que le navigateur utilise pour s'abonner (nulle si les notifications téléphone ne sont pas configurées).
export async function getPushPublicKey(): Promise<string | null> {
  await getCurrentContext();
  return vapidConfig()?.publicKey ?? null;
}

/// Enregistre ce téléphone (ou cet ordinateur) pour recevoir les notifications de la personne connectée.
export async function savePushSubscription(input: z.input<typeof SubscriptionSchema>) {
  const ctx = await getCurrentContext();
  const data = SubscriptionSchema.parse(input);
  // Un même appareil ne s'abonne qu'une fois : s'il change de compte, l'abonnement passe au nouveau.
  await prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: { membershipId: ctx.membership.id, endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent ?? null },
    update: { membershipId: ctx.membership.id, p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent ?? null },
  });
}

/// Retire un appareil — seulement s'il appartient à la personne connectée.
export async function removePushSubscription(endpoint: string) {
  const ctx = await getCurrentContext();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, membershipId: ctx.membership.id } });
}

export async function countMyPushDevices(): Promise<number> {
  const ctx = await getCurrentContext();
  return prisma.pushSubscription.count({ where: { membershipId: ctx.membership.id } });
}

const testLimiter = createRateLimiter(5, 10 * 60_000);

export type TestPushResult = { ok: true; sent: number } | { ok: false; error: string };

/// Envoie une notification d'essai à tous les appareils de la personne, pour vérifier que ça marche.
export async function sendTestPush(): Promise<TestPushResult> {
  const ctx = await getCurrentContext();
  if (!vapidConfig()) return { ok: false, error: "Les notifications sur téléphone ne sont pas encore configurées sur ce serveur." };
  if (!testLimiter.allow(ctx.membership.id, Date.now())) return { ok: false, error: "Trop d'essais. Réessaie dans quelques minutes." };
  const sent = await sendPushToMember(ctx.membership.id, { title: "MYRESTO", body: "Les notifications fonctionnent sur cet appareil.", url: "/parametres?tab=notifications", tag: "test" });
  if (sent === 0) return { ok: false, error: "Aucun appareil n'a reçu l'essai. Réactive les notifications puis réessaie." };
  return { ok: true, sent };
}
