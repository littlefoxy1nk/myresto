import type { StockStatus } from "./types";

/// Estimation du nombre de jours restants au rythme de consommation déclaré. null si
/// aucune consommation moyenne n'est connue pour ce produit — mieux vaut ne rien
/// afficher que d'inventer un delai (voir Mission Coûts & Stock, même principe que
/// pour les finances : jamais un chiffre que la donnée ne permet pas d'établir).
export function computeDaysLeft(currentStock: number, avgDailyUsage: number): number | null {
  if (avgDailyUsage <= 0) return null;
  return Math.floor(currentStock / avgDailyUsage);
}

/// "critical" seulement quand on peut estimer qu'il reste 1 jour ou moins de stock ;
/// sinon "low" dès que le seuil de réapprovisionnement est atteint, même sans pouvoir
/// dater la rupture.
export function computeStockStatus(currentStock: number, reorderThreshold: number, daysLeft: number | null): StockStatus {
  if (currentStock > reorderThreshold) return "ok";
  if (daysLeft != null && daysLeft <= 1) return "critical";
  return "low";
}
