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
