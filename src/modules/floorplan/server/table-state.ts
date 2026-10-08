import { timeToMinutes, nowMinutes as computeNowMinutes } from "@/lib/time";
import type { TableLiveState, TableManualStatus, TableUpcomingReservation } from "@/modules/floorplan/types";

const SOON_THRESHOLD_MINUTES = 45;

export type ReservationForStateCalc = {
  id: string;
  customerName: string;
  partySize: number;
  time: string; // "HH:MM"
  status: string;
  durationMinutes: number;
};

/// Calcule l'état affiché d'une table à un instant donné, à partir de son statut manuel
/// et des réservations du jour qui la concernent. Fonction pure et déterministe : aucun
/// accès base de données ici, pour rester testable et réutilisable telle quelle par le
/// futur Mode Service (qui aura juste besoin d'appeler ceci avec `now` = l'heure réelle).
export function computeTableLiveState(
  manualStatus: TableManualStatus,
  reservationsToday: ReservationForStateCalc[],
  now: Date
): { liveState: TableLiveState; activeReservation: TableUpcomingReservation | null } {
  if (manualStatus === "unavailable") {
    return { liveState: "unavailable", activeReservation: null };
  }

  const nowMinutes = computeNowMinutes(now);
  const withMinutes = reservationsToday
    .filter((r) => r.status !== "cancelled" && r.status !== "no_show")
    .map((r) => {
      const startMinutes = timeToMinutes(r.time);
      return { r, startMinutes, endMinutes: startMinutes + r.durationMinutes };
    });

  const current = withMinutes.find(
    (x) => (x.r.status === "arrived" || x.r.status === "seated") && nowMinutes < x.endMinutes
  );
  if (current) {
    return {
      liveState: "occupied",
      activeReservation: toUpcoming(current.r, current.startMinutes - nowMinutes),
    };
  }

  if (manualStatus === "cleaning") {
    return { liveState: "cleaning", activeReservation: null };
  }

  const upcoming = withMinutes
    .filter((x) => (x.r.status === "new" || x.r.status === "confirmed") && x.startMinutes >= nowMinutes - 15)
    .sort((a, b) => a.startMinutes - b.startMinutes)[0];

  if (upcoming) {
    const minutesFromNow = upcoming.startMinutes - nowMinutes;
    return {
      liveState: minutesFromNow <= SOON_THRESHOLD_MINUTES ? "soon" : "reserved",
      activeReservation: toUpcoming(upcoming.r, minutesFromNow),
    };
  }

  return { liveState: "available", activeReservation: null };
}

/// Calcule si une table est libre pour un créneau donné (pas "maintenant" — un horaire
/// choisi par l'utilisateur, potentiellement futur). Sœur de computeTableLiveState mais
/// pour une question différente : pas "que se passe-t-il là maintenant" mais "cette table
/// est-elle libre pour CE créneau précis". Utilisée par le flux de création de réservation ;
/// le moteur de suggestion (suggestions.ts) reste inchangé et consomme le résultat tel quel.
export function computeSlotAvailability(
  manualStatus: TableManualStatus,
  reservationsOnDate: ReservationForStateCalc[],
  requestedStartMinutes: number,
  requestedDurationMinutes: number,
  isToday: boolean,
  excludeReservationId?: string
): { liveState: TableLiveState; activeReservation: TableUpcomingReservation | null } {
  if (manualStatus === "unavailable") {
    return { liveState: "unavailable", activeReservation: null };
  }

  const requestedEndMinutes = requestedStartMinutes + requestedDurationMinutes;
  const conflict = reservationsOnDate
    .filter((r) => r.status !== "cancelled" && r.status !== "no_show" && r.id !== excludeReservationId)
    .map((r) => {
      const startMinutes = timeToMinutes(r.time);
      return { r, startMinutes, endMinutes: startMinutes + r.durationMinutes };
    })
    .find((x) => x.startMinutes < requestedEndMinutes && x.endMinutes > requestedStartMinutes);

  if (conflict) {
    return {
      liveState: "occupied",
      activeReservation: toUpcoming(conflict.r, conflict.startMinutes - requestedStartMinutes),
    };
  }

  // "Nettoyage" est un statut opérationnel du jour même — sans objet pour une date future.
  if (manualStatus === "cleaning" && isToday) {
    return { liveState: "cleaning", activeReservation: null };
  }

  return { liveState: "available", activeReservation: null };
}

/// État d'une table pour une journée/un service choisi à l'avance (aperçu des jours à
/// venir) : pas de notion de "maintenant", juste "est-elle réservée dans cette fenêtre ?".
/// Une réservation compte si elle chevauche la fenêtre [windowStart, windowEnd[ ; toutes
/// celles qui comptent sont renvoyées, triées par heure, pour pouvoir afficher un double
/// service sur la même table. `minutesFromNow` est fixé à 0 : il n'a pas de sens ici.
export function computeTableStateForWindow(
  manualStatus: TableManualStatus,
  reservationsOnDate: ReservationForStateCalc[],
  windowStartMinutes: number,
  windowEndMinutes: number
): { liveState: TableLiveState; reservations: TableUpcomingReservation[] } {
  if (manualStatus === "unavailable") {
    return { liveState: "unavailable", reservations: [] };
  }

  const reservations = reservationsOnDate
    .filter((r) => r.status !== "cancelled" && r.status !== "no_show")
    .map((r) => ({ r, start: timeToMinutes(r.time) }))
    .filter((x) => x.start < windowEndMinutes && x.start + x.r.durationMinutes > windowStartMinutes)
    .sort((a, b) => a.start - b.start)
    .map((x) => toUpcoming(x.r, 0));

  return { liveState: reservations.length > 0 ? "reserved" : "available", reservations };
}

function toUpcoming(r: ReservationForStateCalc, minutesFromNow: number): TableUpcomingReservation {
  return {
    id: r.id,
    customerName: r.customerName,
    partySize: r.partySize,
    time: r.time,
    status: r.status,
    minutesFromNow,
  };
}
