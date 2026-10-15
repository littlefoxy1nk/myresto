import { test } from "node:test";
import assert from "node:assert/strict";
import { capitalizeName, formatServiceRanges, joinList, resolveServiceGroup, teamByDepartment, type TodayService } from "./summary";

const ALL = [1, 2, 3, 4, 5, 6, 7];
const midi: TodayService = { id: "m", name: "12h", startTime: "12:00", endTime: "14:30", daysOfWeek: ALL };
const soir1: TodayService = { id: "s1", name: "18h", startTime: "18:00", endTime: "20:30", daysOfWeek: ALL };
const soir2: TodayService = { id: "s2", name: "20h30", startTime: "20:30", endTime: "23:00", daysOfWeek: ALL };
const at = (h: number, m = 0) => new Date(2026, 9, 15, h, m);

test("le soir, on parle des deux services ensemble, même avant qu'ils commencent", () => {
  const g = resolveServiceGroup([midi, soir1, soir2], at(15, 0))!;
  assert.equal(g.status, "upcoming");
  assert.deepEqual(g.services.map((s) => s.id), ["s1", "s2"]);
  assert.deepEqual(g.window, { start: "18:00", end: "23:00" });
  assert.equal(g.periodServices.length, 2);
});

test("pendant le premier service du soir : en cours, et les deux restent cités", () => {
  const g = resolveServiceGroup([midi, soir1, soir2], at(19, 0))!;
  assert.equal(g.status, "current");
  assert.deepEqual(g.services.map((s) => s.id), ["s1", "s2"]);
});

test("entre les deux services du soir : seul le second reste cité, la plage reste celle du soir entier", () => {
  const g = resolveServiceGroup([soir1, { ...soir2, startTime: "21:00" }], at(20, 45))!;
  assert.deepEqual(g.services.map((s) => s.id), ["s2"]);
  assert.equal(g.window.start, "18:00");
  assert.equal(g.status, "current");
  assert.deepEqual(g.periodServices.map((s) => s.id), ["s1", "s2"]);
});

test("le matin : le midi est le prochain service (le soir n'est pas mêlé)", () => {
  const g = resolveServiceGroup([midi, soir1, soir2], at(9, 0))!;
  assert.deepEqual(g.services.map((s) => s.id), ["m"]);
  assert.deepEqual(g.window, { start: "12:00", end: "14:30" });
});

test("plus rien après le dernier service, ou service absent ce jour-là", () => {
  assert.equal(resolveServiceGroup([midi, soir1, soir2], at(23, 30)), null);
  assert.equal(resolveServiceGroup([{ ...midi, daysOfWeek: [1] }], at(10, 0)), null); // jeudi 15/10/2026 ≠ lundi
});

test("joinList", () => {
  assert.equal(joinList([]), "");
  assert.equal(joinList(["A"]), "A");
  assert.equal(joinList(["A", "B"]), "A et B");
  assert.equal(joinList(["A", "B", "C"]), "A, B et C");
});

test("formatServiceRanges : toujours par horaires, jamais par un nom générique", () => {
  assert.equal(formatServiceRanges([{ startTime: "12:00", endTime: "15:00" }]), "de midi à 15h");
  assert.equal(
    formatServiceRanges([{ startTime: "18:00", endTime: "20:30" }, { startTime: "20:30", endTime: "22:00" }]),
    "de 18h à 20h30 et de 20h30 à 22h"
  );
});

test("teamByDepartment : par poste, prénoms uniques triés, horaires hors plage ignorés", () => {
  const window = { start: "18:00", end: "23:00" };
  const lines = teamByDepartment(
    [
      { firstName: "Lio", position: "cuisine", startTime: "17:00", endTime: "23:00" },
      { firstName: "Cesim", position: "cuisine", startTime: "18:00", endTime: "23:00" },
      { firstName: "Genti", position: "salle", startTime: "18:00", endTime: "23:00" },
      { firstName: "Genti", position: "salle", startTime: "19:00", endTime: "22:00" },
      { firstName: "Rudy", position: "salle", startTime: "11:00", endTime: "15:00" },
      { firstName: "Chloé", position: "direction", startTime: "18:00", endTime: "23:00" },
      { firstName: "Zoé", position: "inconnu", startTime: "18:00", endTime: "23:00" },
    ],
    window
  );
  assert.deepEqual(lines, [
    { key: "cuisine", label: "Cuisine", names: ["Cesim", "Lio"] },
    { key: "salle", label: "Salle", names: ["Genti"] },
    { key: "direction", label: "Direction", names: ["Chloé"] },
    { key: "autres", label: "Autres", names: ["Zoé"] },
  ]);
});

test("capitalizeName : majuscule au début de chaque prénom, accents et tirets compris", () => {
  assert.equal(capitalizeName("cesim"), "Cesim");
  assert.equal(capitalizeName("jean-paul"), "Jean-Paul");
  assert.equal(capitalizeName("éloïse"), "Éloïse");
  assert.equal(capitalizeName("Chloé"), "Chloé");
});

test("teamByDepartment : prénoms saisis en minuscules affichés avec majuscule, sans doublon", () => {
  const lines = teamByDepartment(
    [
      { firstName: "cesim", position: "cuisine", startTime: "18:00", endTime: "23:00" },
      { firstName: "Cesim", position: "cuisine", startTime: "19:00", endTime: "22:00" },
    ],
    { start: "18:00", end: "23:00" }
  );
  assert.deepEqual(lines[0].names, ["Cesim"]);
});
