import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { sanitizeHeader } from "@/modules/settings/contact";

/// Les deux emails automatiques de la réservation en ligne. Textes factuels (rien d'inventé : seulement ce qui est dans la
/// réservation), sans image ni lien de suivi. Au client on dit « vous » ; à l'équipe, « tu » comme partout dans l'appli.

type Reservation = {
  customerName: string;
  partySize: number;
  date: Date;
  time: string;
  specialRequests?: string | null;
  customerPhone?: string | null;
};

type Place = { name: string; address?: string | null; postalCode?: string | null; city?: string | null };

const dayLabel = (date: Date) => format(date, "EEEE d MMMM yyyy", { locale: fr });
const persons = (n: number) => `${n} personne${n > 1 ? "s" : ""}`;

export function placeAddress(place: Place): string {
  const line2 = [place.postalCode, place.city].filter(Boolean).join(" ");
  return [place.address, line2].filter((p) => p && p.trim()).join(", ");
}

/// À l'équipe : une demande vient d'arriver sur le lien de réservation en ligne.
export function buildBookingAlertEmail(reservation: Reservation, place: Place, reservationsUrl: string | null): { subject: string; text: string } {
  const lines = [
    "Une nouvelle demande de réservation vient d'arriver par le lien en ligne :",
    "",
    `• ${reservation.customerName} — ${persons(reservation.partySize)}`,
    `• ${dayLabel(reservation.date)} à ${reservation.time}`,
  ];
  if (reservation.customerPhone) lines.push(`• GSM : ${reservation.customerPhone}`);
  if (reservation.specialRequests) lines.push(`• Remarque du client : ${reservation.specialRequests}`);
  lines.push("", "Choisis la table et confirme la demande dans MYRESTO.");
  if (reservationsUrl) lines.push(reservationsUrl);
  return {
    subject: sanitizeHeader(`Nouvelle demande : ${reservation.customerName}, ${persons(reservation.partySize)}, ${format(reservation.date, "d MMM", { locale: fr })} à ${reservation.time} — ${place.name}`),
    text: lines.join("\n"),
  };
}

/// Au client : sa réservation est confirmée.
export function buildGuestConfirmationEmail(reservation: Reservation, place: Place): { subject: string; text: string } {
  const address = placeAddress(place);
  const lines = [
    "Bonjour,",
    "",
    `Votre réservation chez ${place.name} est confirmée :`,
    "",
    `• ${dayLabel(reservation.date)} à ${reservation.time}`,
    `• ${persons(reservation.partySize)}`,
    `• Au nom de : ${reservation.customerName}`,
  ];
  if (reservation.specialRequests) lines.push(`• Votre remarque : ${reservation.specialRequests}`);
  if (address) lines.push("", `Adresse : ${address}`);
  lines.push("", "Un imprévu ? Répondez simplement à cet email pour modifier ou annuler votre réservation.", "", `À bientôt chez ${place.name} !`);
  return {
    subject: sanitizeHeader(`Votre réservation chez ${place.name} est confirmée — ${format(reservation.date, "EEEE d MMMM", { locale: fr })} à ${reservation.time}`),
    text: lines.join("\n"),
  };
}
