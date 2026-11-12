import nodemailer from "nodemailer";
import type { SmtpConfig } from "@/modules/settings/contact";

/// Envoie un email via le serveur SMTP configuré. Lève une erreur en cas d'échec (l'appelant la garde
/// avec le message pour ne rien perdre).
export async function sendMail(
  smtp: SmtpConfig,
  mail: { to: string; subject: string; text: string; replyTo?: string; fromName?: string }
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await transport.sendMail({ from: displayFrom(smtp.from, mail.fromName), to: mail.to, replyTo: mail.replyTo, subject: mail.subject, text: mail.text });
}

/// Le nom affiché à côté de l'adresse d'envoi (ex. « La Valaisanne » <adresse>), pour que le client reconnaisse le restaurant.
/// Si l'adresse d'envoi configurée contient déjà un nom, on n'y touche pas.
export function displayFrom(from: string, name?: string): string {
  const clean = (name ?? "").replace(/[\r\n"<>]+/g, " ").trim();
  if (!clean || from.includes("<")) return from;
  return `"${clean}" <${from}>`;
}
