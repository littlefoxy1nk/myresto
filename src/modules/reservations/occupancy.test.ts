import { test } from "node:test";
import assert from "node:assert/strict";
import { completedStillBlocks, nonBlockingStatuses } from "./occupancy";

const now = new Date(2026, 10, 13, 14, 10);

test("un repas terminé libère la table pour maintenant et pour plus tard aujourd'hui", () => {
  assert.equal(completedStillBlocks(new Date(2026, 10, 13), 14 * 60 + 10, now), false);
  assert.equal(completedStillBlocks(new Date(2026, 10, 13), 19 * 60, now), false);
});

test("un créneau déjà passé garde l'historique, comme un jour passé", () => {
  assert.equal(completedStillBlocks(new Date(2026, 10, 13), 12 * 60, now), true);
  assert.equal(completedStillBlocks(new Date(2026, 10, 12), 19 * 60, now), true);
});

test("un jour à venir : rien à garder", () => {
  assert.equal(completedStillBlocks(new Date(2026, 10, 14), 12 * 60, now), false);
});

test("statuts qui ne bloquent pas", () => {
  assert.deepEqual(nonBlockingStatuses(new Date(2026, 10, 13), 15 * 60, now), ["cancelled", "no_show", "completed"]);
  assert.deepEqual(nonBlockingStatuses(new Date(2026, 10, 12), 15 * 60, now), ["cancelled", "no_show"]);
});
