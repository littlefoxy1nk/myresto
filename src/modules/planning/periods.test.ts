import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlanningRows, defaultServiceForRow, describeDays, hasUsualHours, isPlanningView, worstGapsByPosition } from "./periods";

const ALL = [1, 2, 3, 4, 5, 6, 7];
const services = [
  { id: "m", name: "Service de midi à 15h", startTime: "12:00", endTime: "15:00", daysOfWeek: [1, 2, 3, 4, 5, 6] },
  { id: "a", name: "Service de 18h à 20h30", startTime: "18:00", endTime: "20:30", daysOfWeek: ALL },
  { id: "b", name: "Service de 20h30 à 22h", startTime: "20:30", endTime: "22:00", daysOfWeek: [4, 5, 6, 7] },
];

test("par service : une ligne par service, dans l'ordre des horaires", () => {
  const rows = buildPlanningRows([...services].reverse(), "service", false);
  assert.deepEqual(rows.map((r) => r.id), ["m", "a", "b"]);
  assert.deepEqual(rows[1], { id: "a", name: "Service de 18h à 20h30", time: "18:00–20:30", serviceIds: ["a"], daysOfWeek: ALL });
});

test("midi / soir : deux lignes qui regroupent les services, plage complète et jours réunis", () => {
  const rows = buildPlanningRows(services, "periode", false);
  assert.deepEqual(rows.map((r) => [r.id, r.name, r.time, r.serviceIds]), [
    ["periode-midi", "Midi", "12:00–15:00", ["m"]],
    ["periode-soir", "Soir", "18:00–22:00", ["a", "b"]],
  ]);
  assert.deepEqual(rows[1].daysOfWeek, ALL); // 18h tous les jours ∪ 20h30 jeudi→dimanche
  assert.deepEqual(rows[0].daysOfWeek, [1, 2, 3, 4, 5, 6]);
});

test("midi / soir : une période sans service n'a pas de ligne", () => {
  assert.deepEqual(buildPlanningRows([services[1], services[2]], "periode", false).map((r) => r.name), ["Soir"]);
  assert.deepEqual(buildPlanningRows([services[0]], "periode", false).map((r) => r.name), ["Midi"]);
});

test("la ligne « Sans service » s'ajoute à la fin dans les deux modes", () => {
  for (const view of ["service", "periode"] as const) {
    const rows = buildPlanningRows(services, view, true);
    assert.equal(rows[rows.length - 1].id, "none");
    assert.equal(rows[rows.length - 1].daysOfWeek, null);
  }
});

test("worstGapsByPosition : le pire manque, jamais la somme", () => {
  const out = worstGapsByPosition([
    { position: "salle", required: 3, assigned: 2 },
    { position: "salle", required: 3, assigned: 1 },
    { position: "cuisine", required: 2, assigned: 2 },
    { position: "bar", required: 1, assigned: 0 },
  ]);
  assert.deepEqual(out.sort((a, b) => a.position.localeCompare(b.position)), [
    { position: "bar", missing: 1 },
    { position: "salle", missing: 2 },
  ]);
});

test("defaultServiceForRow : premier service actif ce jour-là, null pour « sans service »", () => {
  const [, soir] = buildPlanningRows(services, "periode", false);
  assert.equal(defaultServiceForRow(soir, services, 1), "a"); // lundi : seul le 18h existe
  assert.equal(defaultServiceForRow(soir, services, 5), "a");
  const none = buildPlanningRows(services, "service", true).at(-1)!;
  assert.equal(defaultServiceForRow(none, services, 1), null);
});

test("isPlanningView", () => {
  assert.equal(isPlanningView("service"), true);
  assert.equal(isPlanningView("periode"), true);
  assert.equal(isPlanningView("autre"), false);
});

test("des horaires habituels : début et fin de services de la ligne", () => {
  assert.equal(hasUsualHours({ startTime: "18:00", endTime: "20:30" }, ["a", "b"], services), true);
  assert.equal(hasUsualHours({ startTime: "20:30", endTime: "22:00" }, ["a", "b"], services), true);
  // toute la soirée, du début du premier service à la fin du dernier
  assert.equal(hasUsualHours({ startTime: "18:00", endTime: "22:00" }, ["a", "b"], services), true);
  assert.equal(hasUsualHours({ startTime: "19:00", endTime: "23:00" }, ["a", "b"], services), false);
  assert.equal(hasUsualHours({ startTime: "18:00", endTime: "23:00" }, ["a", "b"], services), false);
  assert.equal(hasUsualHours({ startTime: "12:00", endTime: "15:00" }, ["none"], services), false);
});

test("les jours : fermé quand aucune ligne n'a lieu, aujourd'hui et passé repérés", () => {
  const isoDayOf = (key: string) => ({ "2026-10-12": 1, "2026-10-13": 2, "2026-10-14": 3 })[key as "2026-10-12"] ?? 7;
  const rows = [{ daysOfWeek: [2, 3] }, { daysOfWeek: [3] }];
  const days = describeDays(["2026-10-12", "2026-10-13", "2026-10-14"], rows, "2026-10-13", isoDayOf);
  assert.deepEqual(days.map((d) => d.closed), [true, false, false]);
  assert.deepEqual(days.map((d) => d.isToday), [false, true, false]);
  assert.deepEqual(days.map((d) => d.isPast), [true, false, false]);
});

test("une ligne « sans service » (toujours active) garde tous les jours ouverts", () => {
  const days = describeDays(["2026-10-12"], [{ daysOfWeek: [3] }, { daysOfWeek: null }], "2026-10-13", () => 1);
  assert.equal(days[0].closed, false);
});
