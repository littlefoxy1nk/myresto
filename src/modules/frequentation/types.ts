// Fréquentation : ce que les réservations et l'historique réel montrent sur une
// journée — jamais une décision de staffing. Voir compute.ts pour le principe central :
// aucune moyenne, aucun niveau n'est affiché s'il n'est pas soutenu par assez de données
// réelles.

export type FrequentationLevel = "faible" | "normale" | "elevee" | "indeterminee";

export type FrequentationSignal = {
  expectedCovers: number;
  /// null si pas assez d'historique pour ce jour de semaine — jamais une moyenne
  /// calculée sur un seul échantillon.
  historicalAverageCovers: number | null;
  /// Nombre de jours de même jour de semaine utilisés pour la moyenne.
  sampleSize: number;
  /// Écart relatif à la moyenne historique, null si aucune moyenne n'existe.
  percentDelta: number | null;
  level: FrequentationLevel;
};

export type LargeGroup = {
  reservationId: string;
  customerName: string;
  time: string;
  partySize: number;
};
