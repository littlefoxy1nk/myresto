import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMoves, capacityOfTables, conflictsOnTables, isMovable, planConflicts, type DayBooking } from "./move";

function b(id: string, time: string, tableIds: string[], status = "confirmed", durationMinutes = 90): DayBooking {
  return { id, customerName: id, partySize: 2, time, durationMinutes, status, tableIds };
}

test("conflit : même table et créneaux qui se chevauchent", () => {
  const day = [b("dupont", "20:00", ["t8"])];
  assert.deepEqual(conflictsOnTables(day, ["t8"], { time: "20:30", durationMinutes: 90 }).map((x) => x.id), ["dupont"]);
});

test("pas de conflit : autre table, créneau qui se touche seulement, annulée ou no-show", () => {
  const day = [b("a", "20:00", ["t8"]), b("c", "20:00", ["t9"], "cancelled"), b("n", "20:00", ["t9"], "no_show")];
  assert.equal(conflictsOnTables(day, ["t7"], { time: "20:00", durationMinutes: 90 }).length, 0);
  assert.equal(conflictsOnTables(day, ["t8"], { time: "21:30", durationMinutes: 90 }).length, 0);
  assert.equal(conflictsOnTables(day, ["t9"], { time: "20:00", durationMinutes: 90 }).length, 0);
});

test("la réservation qu'on déplace est ignorée", () => {
  const day = [b("a", "20:00", ["t6"])];
  assert.equal(conflictsOnTables(day, ["t6"], day[0], ["a"]).length, 0);
});

test("échange 6 <-> 8 : plan valide", () => {
  const day = [b("a", "20:00", ["t6"]), b("dupont", "20:00", ["t8"])];
  assert.deepEqual(planConflicts(day, { a: ["t8"], dupont: ["t6"] }), []);
});

test("déplacer sans résoudre l'occupante : conflit signalé", () => {
  const day = [b("a", "20:00", ["t6"]), b("dupont", "20:00", ["t8"])];
  const out = planConflicts(day, { a: ["t8"] });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].with.map((x) => x.id), ["dupont"]);
});

test("l'occupante déplacée sur la 7 : valide ; sur une table prise par une troisième : conflit", () => {
  const day = [b("a", "20:00", ["t6"]), b("dupont", "20:00", ["t8"]), b("marc", "20:00", ["t7"])];
  assert.equal(planConflicts(day, { a: ["t8"], dupont: ["t6"] }).length, 0);
  assert.equal(planConflicts(day, { a: ["t8"], dupont: ["t7"] }).length, 1);
});

test("deux déplacées vers la même table au même créneau : conflit", () => {
  const day = [b("a", "20:00", ["t6"]), b("d1", "20:00", ["t8"]), b("d2", "20:00", ["t9"])];
  assert.ok(planConflicts(day, { a: ["t8"], d1: ["t5"], d2: ["t5"] }).length > 0);
});

test("applyMoves ne touche que les réservations déplacées", () => {
  const day = [b("a", "20:00", ["t6"]), b("x", "20:00", ["t1"])];
  const out = applyMoves(day, { a: ["t8"] });
  assert.deepEqual(out.map((x) => x.tableIds), [["t8"], ["t1"]]);
});

test("capacité : somme, ou capacité combinée du groupe partagé", () => {
  const g = { id: "g", combinedCapacity: 6 };
  assert.equal(capacityOfTables([{ id: "1", capacity: 3, group: null }]), 3);
  assert.equal(capacityOfTables([{ id: "1", capacity: 4, group: g }, { id: "2", capacity: 4, group: g }]), 6);
  assert.equal(capacityOfTables([{ id: "1", capacity: 4, group: g }, { id: "2", capacity: 4, group: null }]), 8);
  assert.equal(capacityOfTables([]), 0);
});

test("seules les réservations ouvertes sont déplaçables", () => {
  assert.ok(isMovable("seated"));
  assert.ok(!isMovable("completed"));
  assert.ok(!isMovable("cancelled"));
});
