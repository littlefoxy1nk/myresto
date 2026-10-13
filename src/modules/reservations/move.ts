// Logique pure du "changer de table" : qui gêne qui sur un créneau, ce que donne un
// échange, quelle capacité offre un ensemble de tables. Aucune dépendance serveur — le
// même calcul sert à l'écran (pour proposer/signaler) et se vérifie en test ; le serveur
// (moveReservation) revérifie de toute façon dans sa transaction.

import { timeToMinutes } from "@/lib/time";

export type DayBooking = {
  id: string;
  customerName: string;
  partySize: number;
  time: string;
  durationMinutes: number;
  status: string;
  tableIds: string[];
};

export type MovableTable = {
  id: string;
  capacity: number;
  group: { id: string; combinedCapacity: number } | null;
};

/// Mêmes statuts que le contrôle de conflit serveur (assertNoTableConflict) : seules les
/// annulées et no-show libèrent la table.
const INACTIVE_STATUSES = ["cancelled", "no_show"];
/// Une réservation terminée occupe encore son créneau côté serveur, mais ça n'a pas de
/// sens de la déplacer : on ne propose le déplacement que pour les réservations ouvertes.
const MOVABLE_STATUSES = ["new", "confirmed", "arrived", "seated"];

export function isMovable(status: string): boolean {
  return MOVABLE_STATUSES.includes(status);
}

type Slot = { time: string; durationMinutes: number };

function overlaps(a: Slot, b: Slot): boolean {
  const aStart = timeToMinutes(a.time);
  const bStart = timeToMinutes(b.time);
  return aStart < bStart + b.durationMinutes && aStart + a.durationMinutes > bStart;
}

/// Réservations actives qui chevauchent `slot` sur au moins une des `tableIds`.
export function conflictsOnTables(
  bookings: DayBooking[],
  tableIds: string[],
  slot: Slot,
  ignoreIds: ReadonlySet<string> | string[] = []
): DayBooking[] {
  const ignore = new Set(ignoreIds);
  const wanted = new Set(tableIds);
  return bookings.filter(
    (b) =>
      !ignore.has(b.id) &&
      !INACTIVE_STATUSES.includes(b.status) &&
      b.tableIds.some((id) => wanted.has(id)) &&
      overlaps(b, slot)
  );
}

/// Le jour tel qu'il serait si on appliquait ces déplacements (id de réservation -> nouvelles tables).
export function applyMoves(bookings: DayBooking[], moves: Record<string, string[]>): DayBooking[] {
  return bookings.map((b) => (moves[b.id] ? { ...b, tableIds: moves[b.id] } : b));
}

/// Après application des déplacements, quelles réservations déplacées se marchent encore
/// dessus (avec une autre réservation, déplacée ou non) ? Liste vide = le plan est valide.
export function planConflicts(
  bookings: DayBooking[],
  moves: Record<string, string[]>
): { booking: DayBooking; with: DayBooking[] }[] {
  const after = applyMoves(bookings, moves);
  const result: { booking: DayBooking; with: DayBooking[] }[] = [];
  for (const id of Object.keys(moves)) {
    const booking = after.find((b) => b.id === id);
    if (!booking) continue;
    const clashing = conflictsOnTables(after, booking.tableIds, booking, [id]);
    if (clashing.length > 0) result.push({ booking, with: clashing });
  }
  return result;
}

/// Capacité d'un ensemble de tables — même règle que le serveur : si plusieurs tables
/// appartiennent toutes à un même groupe actif, la capacité combinée du groupe prime.
export function capacityOfTables(tables: MovableTable[]): number {
  if (tables.length === 0) return 0;
  const sharedGroup =
    tables.length > 1
      ? tables[0].group && tables.every((t) => t.group?.id === tables[0].group!.id)
        ? tables[0].group
        : null
      : null;
  return sharedGroup ? sharedGroup.combinedCapacity : tables.reduce((s, t) => s + t.capacity, 0);
}
