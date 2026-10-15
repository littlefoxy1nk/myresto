import { test } from "node:test";
import assert from "node:assert/strict";
import { CountdownSchema, daysUntil, describeDays, upcomingEvents } from "./countdown";

const today = new Date(2026, 9, 15, 22, 30); // 15 octobre, tard le soir

test("daysUntil : jours calendaires, quelle que soit l'heure", () => {
  assert.equal(daysUntil("2026-10-15", today), 0);
  assert.equal(daysUntil("2026-10-16", today), 1);
  assert.equal(daysUntil("2026-10-14", today), -1);
  assert.equal(daysUntil("2026-12-25", new Date(2026, 9, 15, 1, 0)), 71);
});

test("daysUntil : traverse le changement d'heure sans décalage (fin octobre)", () => {
  assert.equal(daysUntil("2026-11-01", new Date(2026, 9, 25, 12, 0)), 7);
  assert.equal(daysUntil("2026-03-30", new Date(2026, 2, 27, 23, 59)), 3);
});

test("daysUntil : changement d'année", () => {
  assert.equal(daysUntil("2027-01-01", new Date(2026, 11, 31, 10, 0)), 1);
});

test("describeDays", () => {
  assert.deepEqual(describeDays(0), { big: "Aujourd'hui", unit: "c'est le jour J" });
  assert.deepEqual(describeDays(1), { big: "Demain", unit: "c'est pour demain" });
  assert.equal(describeDays(12).big, "12");
});

test("upcomingEvents : passés masqués, le plus proche d'abord", () => {
  const out = upcomingEvents(
    [
      { title: "Noël", date: "2026-12-25" },
      { title: "Hier", date: "2026-10-14" },
      { title: "Soirée", date: "2026-10-20" },
      { title: "Ce soir", date: "2026-10-15" },
    ],
    today
  );
  assert.deepEqual(out.map((e) => [e.title, e.days]), [["Ce soir", 0], ["Soirée", 5], ["Noël", 71]]);
});

test("CountdownSchema : nom et date obligatoires", () => {
  assert.ok(CountdownSchema.safeParse({ title: "Saint-Valentin", date: "2027-02-14" }).success);
  assert.equal(CountdownSchema.safeParse({ title: " ", date: "2027-02-14" }).success, false);
  assert.equal(CountdownSchema.safeParse({ title: "x", date: "14/02/2027" }).success, false);
});
