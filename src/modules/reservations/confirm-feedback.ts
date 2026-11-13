import type { GuestEmailOutcome } from "@/modules/messaging/server/send-emails";

/// Ce que dit l'écran quand on confirme une réservation : si le client a été prévenu par email, sinon pourquoi pas.
/// `email` vaut null quand la réservation était déjà confirmée. `messagesOpened` : l'appli Messages vient de s'ouvrir avec le
/// texte prêt (client sans email) : il ne reste qu'à appuyer sur Envoyer.
export function confirmationFeedback(
  email: GuestEmailOutcome | null,
  contact: { phone: boolean; email: boolean },
  messagesOpened = false
): { message: string; tone: "default" | "warning" } {
  const base = "Réservation confirmée";
  const warn = (detail: string) => ({ message: `${base} · ${detail}`, tone: "warning" as const });

  if (messagesOpened) return { message: `${base} · message prêt dans Messages : appuie sur Envoyer`, tone: "default" };
  if (email === "sent") return { message: `${base} · email envoyé au client`, tone: "default" };
  if (email === "no-email") return contact.phone ? warn("pas d'email enregistré : envoie le message par SMS ou WhatsApp") : warn("ni téléphone ni email : le client n'est pas prévenu");
  if (email === "not-configured") return warn("l'envoi d'emails n'est pas encore configuré sur le serveur");
  if (email === "disabled") return warn("emails automatiques coupés dans les réglages");
  return { message: base, tone: "default" };
}
