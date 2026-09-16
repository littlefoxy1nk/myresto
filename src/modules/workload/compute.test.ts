import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWorkloadSummary } from "./compute";

test("computeWorkloadSummary aggregates covers and reservations per zone", () => {
  const summary = computeWorkloadSummary(
    [
      { time: "19:00", partySize: 2, zoneId: "z1" },
      { time: "19:30", partySize: 4, zoneId: "z1" },
      { time: "20:00", partySize: 3, zoneId: "z2" },
    ],
    [
      { id: "z1", name: "Terrasse", tablesCount: 5 },
      { id: "z2", name: "Salle", tablesCount: 8 },
    ]
  );

  assert.equal(summary.totalCovers, 9);
  assert.equal(summary.totalReservations, 3);
  const z1 = summary.byZone.find((z) => z.zoneId === "z1")!;
  assert.equal(z1.covers, 6);
  assert.equal(z1.reservationsCount, 2);
});

test("computeWorkloadSummary groups unassigned reservations under their own bucket", () => {
  const summary = computeWorkloadSummary(
    [{ time: "19:00", partySize: 2, zoneId: null }],
    [{ id: "z1", name: "Terrasse", tablesCount: 5 }]
  );
  const unassigned = summary.byZone.find((z) => z.zoneName === "Sans table assignée");
  assert.ok(unassigned);
  assert.equal(unassigned!.covers, 2);
});

test("computeWorkloadSummary buckets arrivals into 30-minute windows by default", () => {
  const summary = computeWorkloadSummary(
    [
      { time: "19:00", partySize: 2, zoneId: null },
      { time: "19:15", partySize: 4, zoneId: null },
      { time: "20:00", partySize: 2, zoneId: null },
    ],
    []
  );
  const window19 = summary.arrivalConcentration.find((w) => w.startTime === "19:00");
  assert.ok(window19);
  assert.equal(window19!.covers, 6);
  assert.equal(window19!.reservationsCount, 2);
});
