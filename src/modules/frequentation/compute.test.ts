import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFrequentationSignal, detectNotableConcentration, detectLargeGroups } from "./compute";

test("computeFrequentationSignal refuses to fabricate a baseline from too little history", () => {
  const signal = computeFrequentationSignal(80, [50]);
  assert.equal(signal.level, "indeterminee");
  assert.equal(signal.historicalAverageCovers, null);
});

test("computeFrequentationSignal still refuses a baseline at 3 samples — durci depuis l'audit (2 était trop peu fiable)", () => {
  const signal = computeFrequentationSignal(86, [52, 48, 56]);
  assert.equal(signal.level, "indeterminee");
  assert.equal(signal.historicalAverageCovers, null);
});

test("computeFrequentationSignal flags a notably busier day than the historical same-weekday average", () => {
  // 86 vs. ~52 habituellement un vendredi — l'exemple donné dans la spec, largement au-dessus du seuil.
  const signal = computeFrequentationSignal(86, [52, 48, 56, 50]);
  assert.equal(signal.level, "elevee");
  assert.equal(signal.historicalAverageCovers, 52);
});

test("computeFrequentationSignal flags a notably quieter day", () => {
  const signal = computeFrequentationSignal(20, [50, 52, 48, 50]);
  assert.equal(signal.level, "faible");
});

test("computeFrequentationSignal treats a small deviation as normal, not notable", () => {
  const signal = computeFrequentationSignal(55, [50, 52, 48, 50]);
  assert.equal(signal.level, "normale");
});

test("detectNotableConcentration ignores a busy window with too few reservations", () => {
  const result = detectNotableConcentration([{ startTime: "19:00", covers: 10, reservationsCount: 2 }], 10);
  assert.equal(result, null);
});

test("detectNotableConcentration ignores a window that isn't a large share of the day's covers", () => {
  const result = detectNotableConcentration(
    [
      { startTime: "19:00", covers: 10, reservationsCount: 5 },
      { startTime: "20:00", covers: 12, reservationsCount: 5 },
    ],
    40
  );
  assert.equal(result, null);
});

test("detectNotableConcentration flags a genuinely dominant arrival window", () => {
  const result = detectNotableConcentration(
    [
      { startTime: "19:00", covers: 20, reservationsCount: 5 },
      { startTime: "21:00", covers: 5, reservationsCount: 2 },
    ],
    25
  );
  assert.equal(result?.startTime, "19:00");
});

test("detectLargeGroups only flags parties that exceed the largest single table", () => {
  const groups = detectLargeGroups(
    [
      { id: "r1", customerName: "Dupont", time: "19:00", partySize: 4 },
      { id: "r2", customerName: "Martin", time: "20:00", partySize: 9 },
    ],
    8
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].reservationId, "r2");
});

test("detectLargeGroups returns nothing when table capacity is unknown", () => {
  const groups = detectLargeGroups([{ id: "r1", customerName: "Dupont", time: "19:00", partySize: 20 }], 0);
  assert.deepEqual(groups, []);
});
