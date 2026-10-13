import { test } from "node:test";
import assert from "node:assert/strict";
import { monthSeries, monthTotals, weekdaySeries, yearsPresent, yearTotals, type DayValue } from "./chart-data";

// 2026-09-05 et 2026-09-12 sont des samedis ; 2026-09-08 un mardi.
const days: DayValue[] = [
  { date: "2026-09-05", value: 200000 },
  { date: "2026-09-08", value: 60000 },
  { date: "2026-09-12", value: 300000 },
  { date: "2025-09-06", value: 100000 },
];

test("monthTotals : somme des jours, ou total du mois s'il est saisi", () => {
  const t = monthTotals(days, []);
  assert.equal(t.get("2026-9")!.value, 560000);
  assert.equal(t.get("2026-9")!.source, "days");

  const withMonth = monthTotals(days, [{ year: 2026, month: 9, value: 900000 }]);
  assert.equal(withMonth.get("2026-9")!.value, 900000);
  assert.equal(withMonth.get("2026-9")!.source, "month");
});

test("monthTotals : mois saisi seul, sans aucun jour", () => {
  const t = monthTotals([], [{ year: 2024, month: 1, value: 500000 }]);
  assert.equal(t.get("2024-1")!.value, 500000);
});

test("yearsPresent : années triées, jours et mois confondus", () => {
  assert.deepEqual(yearsPresent(days, [{ year: 2024, month: 1, value: 1 }]), [2024, 2025, 2026]);
});

test("monthSeries : 12 points, null hors mois renseignés", () => {
  const s = monthSeries(monthTotals(days, []), [2026]);
  assert.equal(s[0].points.length, 12);
  assert.equal(s[0].points[8], 560000);
  assert.equal(s[0].points[0], null);
});

const allMonths = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

test("weekdaySeries : moyenne par jour saisi (samedi = (200k+300k)/2)", () => {
  const [s] = weekdaySeries(days, [2026], allMonths, "avg");
  assert.equal(s.points[5], 250000); // samedi
  assert.equal(s.points[1], 60000); // mardi
  assert.equal(s.points[0], null); // lundi : aucune donnée
});

test("weekdaySeries : total par jour de la semaine", () => {
  const [s] = weekdaySeries(days, [2026], allMonths, "total");
  assert.equal(s.points[5], 500000);
});

test("weekdaySeries : filtre par mois", () => {
  const [s] = weekdaySeries(days, [2026], new Set([1, 2]), "avg");
  assert.ok(s.points.every((p) => p === null));
});

test("yearTotals : total et nombre de mois renseignés", () => {
  const totals = monthTotals(days, [{ year: 2026, month: 10, value: 100000 }]);
  const [y2026] = yearTotals(totals, [2026]);
  assert.equal(y2026.value, 660000);
  assert.equal(y2026.monthsCovered, 2);
});
