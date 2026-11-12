import * as webpush from "web-push";
import { prisma } from "@/lib/prisma";
import type { PushPayload } from "@/modules/push/payload";

type Env = Record<string, string | undefined>;

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

/// Les clés qui prouvent aux services de notification (Apple, Google…) que les messages viennent bien de MYRESTO.
/// Sans elles, les notifications sur téléphone sont simplement désactivées (celles de l'appli continuent).
export function vapidConfig(env: Env = process.env): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject = env.VAPID_SUBJECT?.trim() || (env.APP_URL?.trim().startsWith("https://") ? env.APP_URL.trim() : "mailto:contact@myresto.app");
  return { publicKey, privateKey, subject };
}

/// Un abonnement mort (téléphone réinitialisé, appli désinstallée, autorisation retirée) répond 404 ou 410 : on l'oublie.
export function isGoneStatus(status: number | undefined): boolean {
  return status === 404 || status === 410;
}

const SEND_TIMEOUT_MS = 6000;

/// Envoie une notification sur tous les téléphones de cette personne. Ne lève jamais d'erreur : un échec d'envoi ne doit
/// pas empêcher l'action qui l'a déclenchée (planning modifié, message publié…). Retourne le nombre d'envois réussis.
export async function sendPushToMember(membershipId: string, payload: PushPayload, env: Env = process.env): Promise<number> {
  const config = vapidConfig(env);
  if (!config) return 0;
  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { membershipId } });
    if (subscriptions.length === 0) return 0;

    const body = JSON.stringify(payload);
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
            vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
            TTL: 60 * 60 * 12,
            urgency: "normal",
            timeout: SEND_TIMEOUT_MS,
          });
          await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
          return true;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (isGoneStatus(status)) await prisma.pushSubscription.deleteMany({ where: { id: sub.id } }).catch(() => {});
          else console.error("Envoi de notification push échoué", status ?? error);
          return false;
        }
      })
    );
    return results.filter(Boolean).length;
  } catch (error) {
    console.error("Notifications push indisponibles", error);
    return 0;
  }
}
