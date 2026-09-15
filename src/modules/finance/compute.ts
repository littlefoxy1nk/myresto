// Fonctions métier pures des finances. Aucune donnée n'est inventée : chaque calcul
// n'utilise que des montants réellement enregistrés (RevenueEntry, CostEntry). Si une
// mesure ne peut pas être établie honnêtement (division par zéro, aucune donnée), la
// fonction renvoie null plutôt qu'un chiffre trompeur.

export function computeAverageTicket(entries: { amountCents: number; covers: number }[]): number | null {
  const totalCovers = entries.reduce((s, e) => s + e.covers, 0);
  if (totalCovers === 0) return null;
  const totalRevenue = entries.reduce((s, e) => s + e.amountCents, 0);
  return Math.round(totalRevenue / totalCovers);
}

/// Part du chiffre d'affaires absorbée par le coût de main-d'œuvre — un indicateur
/// standard en restauration, calculé uniquement à partir de deux montants réels. Ne
/// prétend à aucune notion de "marge nette" : loyer, matière première et charges ne
/// sont pas suivis dans le produit aujourd'hui.
export function computeLaborCostRatio(laborCostCents: number, revenueCents: number): number | null {
  if (revenueCents <= 0) return null;
  return laborCostCents / revenueCents;
}

/// Marge APRÈS main-d'œuvre uniquement — explicitement pas une marge nette complète.
export function computeMarginAfterLabor(revenueCents: number, laborCostCents: number): number {
  return revenueCents - laborCostCents;
}
