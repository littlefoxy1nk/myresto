import nodemailer from "nodemailer";
import type { SmtpConfig } from "@/modules/settings/contact";

/// Envoie un email via le serveur SMTP configuré. Lève une erreur en cas d'échec (l'appelant la garde
/// avec le message pour ne rien perdre).
export async function sendMail(
  smtp: SmtpConfig,
  mail: { to: string; subject: string; text: string; replyTo?: string }
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
  await transport.sendMail({ from: smtp.from, to: mail.to, replyTo: mail.replyTo, subject: mail.subject, text: mail.text });
}
