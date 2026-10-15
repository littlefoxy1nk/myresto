import { test } from "node:test";
import assert from "node:assert/strict";
import { zoneColumns } from "./layout";

const room = (...xs: [number, number][]) => ({ tables: xs.map(([posX, width]) => ({ posX, width })) });

test("des largeurs proportionnelles à celles des plans", () => {
  // plan de 100 de large (+80) et plan de 500 de large (+80)
  assert.equal(zoneColumns([room([0, 100]), room([100, 300], [300, 300])]), "minmax(0, 180fr) minmax(0, 580fr)");
});

test("une salle vide garde une largeur raisonnable", () => {
  assert.equal(zoneColumns([room(), room([0, 220])]), "minmax(0, 300fr) minmax(0, 300fr)");
});

test("au-delà de trois salles : deux par ligne", () => {
  assert.equal(zoneColumns([room([0, 100]), room([0, 100]), room([0, 100]), room([0, 100])]), "repeat(2, minmax(0, 1fr))");
});
