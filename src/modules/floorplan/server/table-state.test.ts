import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTableLiveState, computeTableStateForWindow, type ReservationForStateCalc } from "./table-state";

function res(id: string, time: string, durationMinutes = 90, status = "confirmed"): ReservationForStateCalc {
  return { id, customerName: id, partySize: 2, time, status, durationMinutes };
}

const DINNER = [19 * 60, 23 * 60] as const;

test("table sans réservation dans la fenêtre : libre", () => {
  const out = computeTableStateForWindow("available", [res("midi", "12:00")], ...DINNER);
  assert.equal(out.liveState, "available");
  assert.equal(out.reservations.length, 0);
});

test("réservation qui chevauche la fenêtre : réservée", () => {
  const out = computeTableStateForWindow("available", [res("soir", "20:00")], ...DINNER);
  assert.equal(out.liveState, "reserved");
  assert.deepEqual(out.reservations.map((r) => r.id), ["soir"]);
});

test("réservation qui finit juste avant la fenêtre ne compte pas, celle qui la déborde compte", () => {
  const before = computeTableStateForWindow("available", [res("fin", "17:30", 90)], ...DINNER);
  assert.equal(before.liveState, "available");
  const overlap = computeTableStateForWindow("available", [res("deborde", "17:45", 90)], ...DINNER);
  assert.equal(overlap.liveState, "reserved");
});

test("annulées et no-show sont ignorées", () => {
  const out = computeTableStateForWindow(
    "available",
    [res("a", "20:00", 90, "cancelled"), res("b", "20:30", 90, "no_show")],
    ...DINNER
  );
  assert.equal(out.liveState, "available");
});

test("double service : toutes les réservations, triées par heure", () => {
  const out = computeTableStateForWindow("available", [res("tard", "21:00"), res("tot", "19:00")], ...DINNER);
  assert.deepEqual(out.reservations.map((r) => r.id), ["tot", "tard"]);
});

test("table indisponible reste indisponible, même sans réservation", () => {
  const out = computeTableStateForWindow("unavailable", [res("soir", "20:00")], ...DINNER);
  assert.equal(out.liveState, "unavailable");
  assert.equal(out.reservations.length, 0);
});

test("le nettoyage n'a pas de sens sur un jour choisi : table libre", () => {
  const out = computeTableStateForWindow("cleaning", [], ...DINNER);
  assert.equal(out.liveState, "available");
});

test("fenêtre pas encore commencée : un repas déjà terminé (client libéré) ne bloque plus la table", () => {
  const walkIn = res("sans-resa", "18:30", 90, "completed");
  const kept = computeTableStateForWindow("available", [walkIn], ...DINNER);
  assert.equal(kept.liveState, "reserved"); // historique d'un service passé : on le garde
  const ignored = computeTableStateForWindow("available", [walkIn], ...DINNER, true);
  assert.equal(ignored.liveState, "available");
  assert.equal(ignored.reservations.length, 0);
});

test("fenêtre pas encore commencée : une réservation confirmée, elle, compte toujours", () => {
  const out = computeTableStateForWindow("available", [res("a", "20:00"), res("b", "18:30", 90, "completed")], ...DINNER, true);
  assert.deepEqual(out.reservations.map((r) => r.id), ["a"]);
});

import { computeSlotAvailability } from "./table-state";

test("créneau d'aujourd'hui : un client libéré ne rend plus la table « occupée »", () => {
  const done = res("sans-resa", "14:00", 90, "completed");
  const blocked = computeSlotAvailability("available", [done], 14 * 60 + 15, 90, true);
  assert.equal(blocked.liveState, "occupied");
  const free = computeSlotAvailability("available", [done], 14 * 60 + 15, 90, true, undefined, true);
  assert.equal(free.liveState, "available");
  // Une réservation encore ouverte, elle, bloque toujours.
  const seated = computeSlotAvailability("available", [res("s", "14:00", 90, "seated")], 14 * 60 + 15, 90, true, undefined, true);
  assert.equal(seated.liveState, "occupied");
});

function at(h: number, m: number) {
  return new Date(2026, 10, 15, h, m);
}

test("une réservation en retard reste sur la table, avec son nom, tant que personne ne l'a traitée", () => {
  const r = res("Dupont", "19:00", 90, "confirmed");
  for (const [h, m] of [[19, 10], [19, 20], [19, 45], [20, 15]] as const) {
    const out = computeTableLiveState("available", [r], at(h, m));
    assert.equal(out.liveState, "soon", `${h}:${m}`);
    assert.equal(out.activeReservation?.customerName, "Dupont", `${h}:${m}`);
    assert.ok((out.activeReservation?.minutesFromNow ?? 0) < 0, `${h}:${m}`);
  }
});

test("même longtemps après l'heure, elle ne disparaît pas toute seule", () => {
  const r = res("Dupont", "12:00", 90, "confirmed");
  for (const [h, m] of [[13, 31], [15, 0], [22, 30]] as const) {
    const out = computeTableLiveState("available", [r], at(h, m));
    assert.equal(out.liveState, "soon", `${h}:${m}`);
    assert.equal(out.activeReservation?.customerName, "Dupont", `${h}:${m}`);
  }
});

test("absent, annulée ou arrivée : le plan suit la décision de l'équipe", () => {
  const late = at(19, 40);
  assert.equal(computeTableLiveState("available", [res("a", "19:00", 90, "no_show")], late).liveState, "available");
  assert.equal(computeTableLiveState("available", [res("a", "19:00", 90, "cancelled")], late).liveState, "available");
  assert.equal(computeTableLiveState("available", [res("a", "19:00", 90, "seated")], late).liveState, "occupied");
});

test("à venir : inchangé (réservée de loin, bientôt dans l'heure)", () => {
  assert.equal(computeTableLiveState("available", [res("a", "21:00")], at(19, 0)).liveState, "reserved");
  assert.equal(computeTableLiveState("available", [res("a", "19:30")], at(19, 0)).liveState, "soon");
});
