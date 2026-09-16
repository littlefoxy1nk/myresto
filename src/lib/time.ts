/// Petites conversions de temps réutilisées par tous les modules qui doivent comparer
/// des horaires "HH:MM" à l'heure courante (Planning, Service, Aujourd'hui, Plan de
/// salle) — centralisées ici pour qu'un seul endroit calcule "quelle heure est-il, en
/// minutes depuis minuit" plutôt que chaque module ne réécrive sa propre version.

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function nowMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

/// Jour de semaine au format ISO (1 = lundi ... 7 = dimanche), utilisé partout où les
/// disponibilités et services sont indexés par jour — Date.getDay() renvoie 0 pour
/// dimanche, ce qui ne correspond à aucune des conventions du produit.
export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}
