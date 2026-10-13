import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHistoryDatasets } from "./history";

test("CA : somme par jour, totaux de mois repris tels quels", () => {
  const d = buildHistoryDatasets(
    [
      { date: "2026-09-05", amountCents: 100000, covers: 40 },
      { date: "2026-09-05", amountCents: 20000, covers: 5 },
    ],
    [{ year: 2025, month: 9, amountCents: 700000, covers: 0 }],
    []
  );
  assert.deepEqual(d.revenue.days, [{ date: "2026-09-05", value: 120000 }]);
  assert.deepEqual(d.revenue.months, [{ year: 2025, month: 9, value: 700000 }]);
});

test("couverts : ceux saisis priment, sinon ceux des réservations honorées (jamais additionnés)", () => {
  const d = buildHistoryDatasets(
    [{ date: "2026-09-05", amountCents: 100000, covers: 40 }],
    [],
    [
      { date: "2026-09-05", partySize: 4 },
      { date: "2026-09-06", partySize: 2 },
      { date: "2026-09-06", partySize: 3 },
    ]
  );
  assert.deepEqual(d.covers.days, [
    { date: "2026-09-05", value: 40 },
    { date: "2026-09-06", value: 5 },
  ]);
});

test("couverts : un total de mois sans couverts n'écrase rien", () => {
  const d = buildHistoryDatasets([], [{ year: 2025, month: 9, amountCents: 1, covers: 0 }, { year: 2025, month: 10, amountCents: 1, covers: 900 }], []);
  assert.deepEqual(d.covers.months, [{ year: 2025, month: 10, value: 900 }]);
});

test("réservations : nombre par jour", () => {
  const d = buildHistoryDatasets([], [], [
    { date: "2026-09-05", partySize: 4 },
    { date: "2026-09-05", partySize: 2 },
    { date: "2026-09-06", partySize: 2 },
  ]);
  assert.deepEqual(d.reservations.days, [
    { date: "2026-09-05", value: 2 },
    { date: "2026-09-06", value: 1 },
  ]);
  assert.deepEqual(d.reservations.months, []);
});
