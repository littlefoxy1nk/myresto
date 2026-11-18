// Vocabulaire des statuts de réservation, partagé par l'écran Réservations, le Mode
// Service et la fiche client — un seul endroit pour ne jamais afficher deux libellés ou
// deux couleurs différentes pour le même statut.

export const RESERVATION_STATUS_LABEL: Record<string, string> = {
  new: "Nouvelle",
  confirmed: "Confirmée",
  arrived: "Arrivée",
  seated: "Installée",
  completed: "Terminée",
  cancelled: "Annulée",
  no_show: "No-show",
};

export const RESERVATION_STATUS_VARIANT: Record<string, "neutral" | "good" | "important" | "urgent" | "accent"> = {
  new: "important",
  confirmed: "accent",
  arrived: "good",
  seated: "good",
  completed: "neutral",
  cancelled: "neutral",
  no_show: "urgent",
};

/// L'état d'une réservation à sa création. Une demande faite EN LIGNE doit être confirmée par le restaurateur (« Nouvelle »), qui prévient
/// alors le client. Une réservation notée à la main — au téléphone, au comptoir — est déjà confirmée : le client vient d'être au bout du
/// fil, il n'y a rien à lui confirmer ni à lui renvoyer comme message.
export function initialReservationState(source: "manual" | "online"): { status: "new" | "confirmed"; confirmationState: "none" | "confirmed" } {
  return source === "online" ? { status: "new", confirmationState: "none" } : { status: "confirmed", confirmationState: "confirmed" };
}
