import type { CustomerStats } from "./types";

/// Fonction pure : dérive les statistiques d'un client de son historique réel de
/// réservations, plutôt que de maintenir un compteur (Customer.visitCount) qu'il
/// faudrait mettre à jour depuis chaque action de statut (confirmer, installer,
/// libérer, annuler...). Une seule vérité, jamais deux chiffres qui peuvent diverger.
/// Une "visite" compte quand le client s'est réellement installé (seated/completed) —
/// "arrived" seul est encore transitoire, "new"/"confirmed"/"cancelled" ne comptent pas.
export function computeCustomerStats(reservations: { date: string; status: string }[]): CustomerStats {
  const visits = reservations.filter((r) => r.status === "seated" || r.status === "completed");
  const noShows = reservations.filter((r) => r.status === "no_show");

  const lastVisitAt = visits.length > 0 ? visits.map((r) => r.date).sort().at(-1)! : null;

  return {
    visitCount: visits.length,
    noShowCount: noShows.length,
    lastVisitAt,
  };
}
