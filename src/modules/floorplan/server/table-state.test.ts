import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTableStateForWindow, type ReservationForStateCalc } from "./table-state";

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
