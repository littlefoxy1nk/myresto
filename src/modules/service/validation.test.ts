import { test } from "node:test";
import assert from "node:assert/strict";
import { validateService } from "./validation";

const all = [1, 2, 3, 4, 5, 6, 7];
const others = [
  { id: "a", name: "18h", startTime: "18:00", endTime: "20:30", days: all },
  { id: "b", name: "20h30", startTime: "20:30", endTime: "23:00", days: all },
];

test("service valide qui touche les autres sans les chevaucher", () => {
  assert.equal(validateService({ name: "Midi", startTime: "12:00", endTime: "14:30", days: all }, others), null);
  assert.equal(validateService({ name: "Goûter", startTime: "15:00", endTime: "18:00", days: all }, others), null);
});

test("chevauchement refusé avec le nom du service gênant", () => {
  const msg = validateService({ name: "X", startTime: "19:00", endTime: "21:00", days: all }, others);
  assert.match(msg!, /chevauche/);
});

test("pas de chevauchement si les jours sont différents", () => {
  const sunday = [{ id: "c", name: "Brunch", startTime: "10:00", endTime: "15:00", days: [7] }];
  assert.equal(validateService({ name: "Midi", startTime: "12:00", endTime: "14:00", days: [1, 2] }, sunday), null);
});

test("se modifier soi-même n'est pas un chevauchement", () => {
  assert.equal(validateService({ name: "18h", startTime: "18:00", endTime: "20:00", days: all }, others, "a"), null);
});

test("entrées invalides", () => {
  assert.match(validateService({ name: " ", startTime: "12:00", endTime: "14:00", days: all }, [])!, /nom/);
  assert.match(validateService({ name: "X", startTime: "12h", endTime: "14:00", days: all }, [])!, /HH:MM/);
  assert.match(validateService({ name: "X", startTime: "14:00", endTime: "12:00", days: all }, [])!, /après/);
  assert.match(validateService({ name: "X", startTime: "12:00", endTime: "14:00", days: [] }, [])!, /jour/);
  assert.match(validateService({ name: "X", startTime: "12:00", endTime: "14:00", days: [8] }, [])!, /jour/);
});
