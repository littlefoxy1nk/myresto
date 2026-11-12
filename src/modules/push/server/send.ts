import * as webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { cleanEnvValue } from "@/lib/env-value";
import type { PushPayload } from "@/modules/push/payload";

type Env = Record<string, string | undefined>;

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

/// Les clés qui prouvent aux services de notification (Apple, Google…) que les messages viennent bien de MYRESTO.
/// Sans elles, les notifications sur téléphone sont simplement désactivées (celles de l'appli continuent).
export function vapidConfig(env: Env = process.env): VapidConfig | null {
  const publicKey = cleanEnvValue(env.VAPID_PUBLIC_KEY);
  const privateKey = cleanEnvValue(env.VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) return null;
  const appUrl = cleanEnvValue(env.APP_URL);
  const subject = cleanEnvValue(env.VAPID_SUBJECT) || (appUrl.startsWith("https://") ? appUrl : "mailto:contact@myresto.app");
  return { publicKey, privateKey, subject };
}

function base64UrlBytes(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  return Buffer.from(value.replace(/=+$/, ""), "base64url");
}

/// Vérifie la forme des clés (sans jamais les afficher) : publique = 65 octets, privée = 32 octets, en base64 « url ».
/// Retourne une explication en français si l'une est mal recopiée, sinon null.
export function vapidKeyProblem(config: VapidConfig): string | null {
  const pub = base64UrlBytes(config.publicKey);
  if (!pub || pub.length !== 65 || pub[0] !== 4) return "La clé publique (VAPID_PUBLIC_KEY) est mal recopiée : elle doit faire environ 87 caractères, sans espace.";
  const priv = base64UrlBytes(config.privateKey);
  if (!priv || priv.length !== 32) return "La clé privée (VAPID_PRIVATE_KEY) est mal recopiée : elle doit faire environ 43 caractères, sans espace.";
  return null;
}

/// Un abonnement mort (téléphone réinitialisé, appli désinstallée, autorisation retirée) répond 404 ou 410 : on l'oublie.
export function isGoneStatus(status: number | undefined): boolean {
  return status === 404 || status === 410;
}

const SEND_TIMEOUT_MS = 6000;

export type PushOutcome = { devices: number; sent: number; failures: { status?: number; reason: string }[]; problem?: string };

/// Comme sendPushToMember, mais dit ce qui s'est passé pour chaque appareil (utile pour l'essai et le diagnostic).
export async function sendPushDetailed(membershipId: string, payload: PushPayload, env: Env = process.env): Promise<PushOutcome> {
  const config = vapidConfig(env);
  if (!config) return { devices: 0, sent: 0, failures: [], problem: "not-configured" };
  const keyProblem = vapidKeyProblem(config);
  if (keyProblem) {
    console.error("Clés de notification invalides", keyProblem);
    return { devices: 0, sent: 0, failures: [], problem: keyProblem };
  }
  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { membershipId } });
    if (subscriptions.length === 0) return { devices: 0, sent: 0, failures: [] };

    const body = JSON.stringify(payload);
    const failures: PushOutcome["failures"] = [];
    let sent = 0;
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
            vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
            TTL: 60 * 60 * 12,
            urgency: "normal",
            timeout: SEND_TIMEOUT_MS,
          });
          sent += 1;
          await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          const reason = ((error as { body?: string }).body || (error as Error).message || "").toString().slice(0, 200);
          if (isGoneStatus(status)) await prisma.pushSubscription.deleteMany({ where: { id: sub.id } }).catch(() => {});
          else console.error("Envoi de notification push échoué", status ?? "", reason);
          failures.push({ status, reason });
        }
      })
    );
    return { devices: subscriptions.length, sent, failures };
  } catch (error) {
    console.error("Notifications push indisponibles", error);
    return { devices: 0, sent: 0, failures: [], problem: "Base de données indisponible pour les notifications." };
  }
}

/// Envoie une notification sur tous les téléphones de cette personne. Ne lève jamais d'erreur : un échec d'envoi ne doit
/// pas empêcher l'action qui l'a déclenchée (planning modifié, message publié…). Retourne le nombre d'envois réussis.
export async function sendPushToMember(membershipId: string, payload: PushPayload, env: Env = process.env): Promise<number> {
  return (await sendPushDetailed(membershipId, payload, env)).sent;
}

/// Traduit l'issue d'un essai en une phrase qui dit quoi faire.
export function explainPushFailure(outcome: PushOutcome): string {
  if (outcome.problem && outcome.problem !== "not-configured") return outcome.problem;
  if (outcome.devices === 0) return "Aucun appareil n'est enregistré pour ton compte. Appuie sur « Couper » puis « Activer » depuis l'appli installée sur l'écran d'accueil.";
  const f = outcome.failures[0];
  const status = f?.status;
  if (status === 403 || status === 401) return `Le service de notification a refusé nos clés (code ${status}). Les clés VAPID de Vercel ne correspondent pas : coupe puis réactive les notifications après avoir vérifié les deux clés.`;
  if (status === 400) return `Le service de notification a refusé le message (code 400${f?.reason ? ` : ${f.reason}` : ""}). Coupe puis réactive les notifications.`;
  if (status === 404 || status === 410) return "Cet appareil n'était plus reconnu : il a été oublié. Réactive les notifications (Activer) puis réessaie.";
  if (status === 429 || (status !== undefined && status >= 500)) return `Le service de notification est momentanément indisponible (code ${status}). Réessaie dans une minute.`;
  if (status === undefined) return `Le serveur n'a pas pu joindre le service de notification${f?.reason ? ` (${f.reason})` : ""}. Réessaie.`;
  return `Le service de notification a répondu par une erreur (code ${status}).`;
}
