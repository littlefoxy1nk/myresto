import { test } from "node:test";
import assert from "node:assert/strict";
import { groupInstantFor, groupWindow, windowsOverlap } from "./group-scope";

const now = new Date(2026, 9, 13, 18, 0);

test("sans date : fusion permanente à partir de maintenant", () => {
  const w = groupWindow(undefined, now);
  assert.equal(w.isPermanent, true);
  assert.equal(w.activeUntil, null);
  assert.equal(w.activeFrom, now);
});

test("avec une date : couvre uniquement cette journée", () => {
  const w = groupWindow("2026-10-15", now);
  assert.equal(w.isPermanent, false);
  assert.equal(w.activeFrom.getDate(), 15);
  assert.equal(w.activeFrom.getHours(), 0);
  assert.equal(w.activeUntil!.getDate(), 15);
  assert.equal(w.activeUntil!.getHours(), 23);
});

test("une date invalide est refusée", () => {
  assert.throws(() => groupWindow("15/10/2026", now));
});

test("deux fusions de jours différents ne se chevauchent pas", () => {
  assert.equal(windowsOverlap(groupWindow("2026-10-15", now), groupWindow("2026-10-16", now)), false);
});

test("deux fusions du même jour se chevauchent", () => {
  assert.equal(windowsOverlap(groupWindow("2026-10-15", now), groupWindow("2026-10-15", now)), true);
});

test("une fusion permanente chevauche un jour futur mais pas un jour passé", () => {
  const permanent = groupWindow(undefined, now);
  assert.equal(windowsOverlap(permanent, groupWindow("2026-12-01", now)), true);
  assert.equal(windowsOverlap(permanent, groupWindow("2026-10-01", now)), false);
});

test("groupInstantFor : maintenant aujourd'hui, midi un autre jour", () => {
  assert.equal(groupInstantFor(new Date(2026, 9, 13), now), now);
  assert.equal(groupInstantFor(new Date(2026, 9, 14), now).getHours(), 12);
});
