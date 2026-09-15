import type { ArrivalWindow } from "@/modules/workload/types";
import type { FrequentationLevel, FrequentationSignal, LargeGroup } from "./types";

/// En dessous de ce nombre de jours de même jour de semaine, on ne peut honnêtement
/// rien affirmer sur "l'habitude" — mieux vaut "indéterminée" qu'une moyenne fondée sur
/// un seul échantillon.
const MIN_SAMPLES_FOR_BASELINE = 2;

/// Écart au-delà duquel une journée est jugée notablement différente de son historique.
/// Un seuil de variabilité de la demande, jamais un seuil de personnel.
const SIGNIFICANT_DELTA_RATIO = 0.3;

/// Compare les couverts attendus d'un jour à la moyenne réelle des mêmes jours de la
/// semaine passés — jamais un jugement sur le personnel nécessaire pour l'absorber.
export function computeFrequentationSignal(expectedCovers: number, historicalSameWeekdayCovers: number[]): FrequentationSignal {
  const sampleSize = historicalSameWeekdayCovers.length;
  if (sampleSize < MIN_SAMPLES_FOR_BASELINE) {
    return { expectedCovers, historicalAverageCovers: null, sampleSize, percentDelta: null, level: "indeterminee" };
  }

  const average = historicalSameWeekdayCovers.reduce((s, c) => s + c, 0) / sampleSize;
  if (average <= 0) {
    return { expectedCovers, historicalAverageCovers: 0, sampleSize, percentDelta: null, level: "indeterminee" };
  }

  const percentDelta = (expectedCovers - average) / average;
  const level: FrequentationLevel =
    percentDelta >= SIGNIFICANT_DELTA_RATIO ? "elevee" : percentDelta <= -SIGNIFICANT_DELTA_RATIO ? "faible" : "normale";

  return { expectedCovers, historicalAverageCovers: Math.round(average), sampleSize, percentDelta, level };
}

// En dessous de ce nombre de réservations, un pic sur un créneau de 30 minutes ne
// représente rien de statistiquement notable pour un service entier.
const CONCENTRATION_MIN_RESERVATIONS = 3;
// Le créneau le plus chargé doit représenter une part significative des couverts du
// jour pour mériter d'être signalé comme une "concentration", pas juste le créneau le
// plus rempli parmi d'autres tout aussi remplis.
const CONCENTRATION_MIN_SHARE = 0.5;

/// Repère le créneau d'arrivée le plus chargé de la journée s'il est réellement notable
/// — jamais une déduction sur le personnel requis pour l'absorber.
export function detectNotableConcentration(windows: ArrivalWindow[], totalCovers: number): ArrivalWindow | null {
  if (totalCovers <= 0 || windows.length === 0) return null;

  const busiest = windows.reduce((max, w) => (w.covers > max.covers ? w : max), windows[0]);
  if (busiest.reservationsCount < CONCENTRATION_MIN_RESERVATIONS) return null;
  if (busiest.covers / totalCovers < CONCENTRATION_MIN_SHARE) return null;

  return busiest;
}

/// Un "gros groupe" est défini par un fait physique de l'établissement — une réservation
/// que la plus grande table seule ne peut pas accueillir — jamais un seuil de personnel
/// arbitraire.
export function detectLargeGroups(
  reservations: { id: string; customerName: string; time: string; partySize: number }[],
  maxSingleTableCapacity: number
): LargeGroup[] {
  if (maxSingleTableCapacity <= 0) return [];
  return reservations
    .filter((r) => r.partySize > maxSingleTableCapacity)
    .map((r) => ({ reservationId: r.id, customerName: r.customerName, time: r.time, partySize: r.partySize }));
}
