import { z } from "zod";

/// L'adresse qui reçoit les messages du formulaire de contact (peut être remplacée par SUPPORT_EMAIL).
export const DEFAULT_SUPPORT_EMAIL = "chloehamoir@gmail.com";

export const CONTACT_CATEGORIES = [
  { key: "probleme", label: "J'ai un problème" },
  { key: "question", label: "J'ai une question" },
  { key: "idee", label: "J'ai une idée" },
] as const;

export const ContactSchema = z.object({
  category: z.enum(["probleme", "question", "idee"]),
  subject: z.string().trim().min(3, "Donne un titre à ton message (3 caractères minimum).").max(120, "Titre trop long (120 caractères maximum)."),
  message: z.string().trim().min(10, "Explique en quelques mots (10 caractères minimum).").max(3000, "Message trop long (3 000 caractères maximum)."),
});

export type ContactInput = z.infer<typeof ContactSchema>;

export type SmtpConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };

/// La configuration d'envoi lue dans l'environnement ; null si elle est incomplète (alors le message est
/// seulement enregistré, jamais perdu). SMTP_FROM par défaut = SMTP_USER.
export function readSmtpConfig(env: Record<string, string | undefined>): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(env.SMTP_PORT) || 587;
  return { host, port, secure: port === 465, user, pass, from: env.SMTP_FROM?.trim() || user };
}

/// Évite l'injection d'en-têtes dans l'objet d'un email : jamais de retour à la ligne.
export function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function buildSupportEmail(params: {
  category: ContactInput["category"];
  subject: string;
  message: string;
  userName: string;
  userEmail: string | null;
  establishmentName: string;
  roleLabel: string;
}): { subject: string; text: string } {
  const category = CONTACT_CATEGORIES.find((c) => c.key === params.category)?.label ?? params.category;
  return {
    subject: sanitizeHeader(`[MYRESTO] ${category} — ${params.subject}`),
    text: [
      params.message,
      "",
      "—",
      `De : ${params.userName}${params.userEmail ? ` <${params.userEmail}>` : ""}`,
      `Établissement : ${params.establishmentName}`,
      `Rôle : ${params.roleLabel}`,
    ].join("\n"),
  };
}
