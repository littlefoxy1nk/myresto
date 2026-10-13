// Fonctions métier pures des finances. Aucune donnée n'est inventée : chaque calcul
// n'utilise que des montants réellement enregistrés (RevenueEntry). Si une
// mesure ne peut pas être établie honnêtement (division par zéro, aucune donnée), la
// fonction renvoie null plutôt qu'un chiffre trompeur.

export function computeAverageTicket(entries: { amountCents: number; covers: number }[]): number | null {
  const totalCovers = entries.reduce((s, e) => s + e.covers, 0);
  if (totalCovers === 0) return null;
  const totalRevenue = entries.reduce((s, e) => s + e.amountCents, 0);
  return Math.round(totalRevenue / totalCovers);
}
