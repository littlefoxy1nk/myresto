import { normalizePhone } from "./phone";

export type MessageKind = "ask" | "confirmed";

/// Variables disponibles dans un modèle : {nom} {personnes} {heure} {date} {restaurant}.
export const MESSAGE_VARIABLES = ["nom", "personnes", "heure", "date", "restaurant"] as const;

export const DEFAULT_TEMPLATES: Record<MessageKind, string> = {
  ask: "Bonjour {nom}, pouvez-vous me confirmer votre réservation de {personnes} pour {date} à {heure} ? Merci ! — {restaurant}",
  confirmed:
    "Bonjour {nom}, votre réservation de {personnes} pour {date} à {heure} est bien confirmée. À bientôt ! — {restaurant}",
};

export const KIND_LABEL: Record<MessageKind, string> = {
  ask: "Demander de confirmer",
  confirmed: "Réservation confirmée",
};

export type MessageVars = { nom: string; personnes: number; heure: string; date: string; restaurant: string };

/// Remplace les {variables} connues ; une variable inconnue est laissée telle quelle pour
/// que la faute de frappe se voie dans l'aperçu plutôt que de disparaître en silence.
export function renderMessage(template: string, vars: MessageVars): string {
  const values: Record<string, string> = {
    nom: vars.nom,
    personnes: `${vars.personnes} personne${vars.personnes > 1 ? "s" : ""}`,
    heure: vars.heure,
    date: vars.date,
    restaurant: vars.restaurant,
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}

export type MessageLinks = { whatsapp: string | null; sms: string | null; email: string | null };

/// Les liens qui ouvrent le message déjà rédigé dans WhatsApp, l'appli SMS ou la messagerie.
/// L'envoi lui-même reste un geste du responsable : aucun fournisseur d'envoi automatique
/// n'est branché, donc rien ne part sans qu'il appuie sur "envoyer".
export function buildMessageLinks(params: {
  phone: string | null | undefined;
  email: string | null | undefined;
  text: string;
  subject: string;
}): MessageLinks {
  const number = normalizePhone(params.phone);
  const body = encodeURIComponent(params.text);
  const email = params.email?.trim();
  return {
    whatsapp: number ? `https://wa.me/${number}?text=${body}` : null,
    sms: number ? `sms:+${number}?&body=${body}` : null,
    email: email ? `mailto:${email}?subject=${encodeURIComponent(params.subject)}&body=${body}` : null,
  };
}
