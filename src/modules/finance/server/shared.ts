/// Source réservée à la clôture manuelle du manager — distincte de "event"/"other", qui
/// restent possibles en plus pour la même date (plusieurs RevenueEntry par jour sont
/// supportés par le modèle). C'est cette source qui identifie l'entrée à mettre à jour
/// plutôt que d'en recréer une nouvelle à chaque clôture.
export const CLOSING_SOURCE = "service";
