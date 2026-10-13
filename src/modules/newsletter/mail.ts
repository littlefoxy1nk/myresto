/// Variables du premier mail : {prenom} {nom} {restaurant} {avis} {desinscription}.
export const MAIL_VARIABLES = ["prenom", "nom", "restaurant", "avis", "desinscription"] as const;

export const DEFAULT_WELCOME_SUBJECT = "Merci pour votre réservation chez {restaurant}";

export const DEFAULT_WELCOME_BODY = `Bonjour {prenom},

Merci d'avoir réservé chez {restaurant} et d'avoir accepté de recevoir nos infos !

Pour mieux vous accueillir, pouvez-vous simplement répondre à ce mail avec :
- votre date d'anniversaire (pour une petite attention le jour J),
- votre numéro de GSM.

{avis}
À très bientôt,
{restaurant}

—
Vous ne souhaitez plus recevoir nos mails ? {desinscription}`;

export type MailVars = {
  prenom: string;
  nom: string;
  restaurant: string;
  /// Texte déjà prêt avec les liens d'avis (vide si aucun lien n'est configuré).
  avis: string;
  desinscription: string;
};

/// Remplace les {variables} connues ; une variable inconnue reste visible dans l'aperçu.
export function renderMail(template: string, vars: MailVars): string {
  const values: Record<string, string> = { ...vars };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}

/// Bloc "laisser un avis" : un lien par plateforme configurée, rien si aucune.
export function reviewBlock(links: { google?: string | null; tripadvisor?: string | null }): string {
  const lines: string[] = [];
  if (links.google) lines.push(`Votre avis sur Google : ${links.google}`);
  if (links.tripadvisor) lines.push(`Votre avis sur TripAdvisor : ${links.tripadvisor}`);
  if (lines.length === 0) return "";
  return `Si vous avez passé un bon moment, un petit avis nous ferait très plaisir :\n${lines.join("\n")}\n`;
}

export function buildMailtoLink(params: { to: string; subject: string; body: string }): string {
  return `mailto:${params.to.trim()}?subject=${encodeURIComponent(params.subject)}&body=${encodeURIComponent(params.body)}`;
}

/// Lien de réponse libre saisi dans Paramètres : accepte seulement http(s). Vide → null ;
/// quelque chose qui n'est pas un lien web → erreur (jamais de "javascript:" ou autre schéma).
export function normalizeReviewUrl(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Ce lien d'avis n'est pas valide.");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) {
    throw new Error("Ce lien d'avis n'est pas valide.");
  }
  return url.toString();
}
