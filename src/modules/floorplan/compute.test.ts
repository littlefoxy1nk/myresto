import { test } from "node:test";
import assert from "node:assert/strict";
import { nextGridPosition, rectsOverlap } from "./compute";

test("nextGridPosition places the first table at the grid origin", () => {
  assert.deepEqual(nextGridPosition(0), { posX: 40, posY: 40 });
});

test("nextGridPosition advances along a row before wrapping", () => {
  assert.deepEqual(nextGridPosition(1), { posX: 140, posY: 40 });
  assert.deepEqual(nextGridPosition(4), { posX: 440, posY: 40 });
});

test("nextGridPosition wraps to a new row after 5 tables", () => {
  assert.deepEqual(nextGridPosition(5), { posX: 40, posY: 140 });
  assert.deepEqual(nextGridPosition(6), { posX: 140, posY: 140 });
});

test("nextGridPosition never places two different indexes at the same spot", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const { posX, posY } = nextGridPosition(i);
    const key = `${posX}:${posY}`;
    assert.ok(!seen.has(key), `index ${i} collides with an earlier one`);
    seen.add(key);
  }
});

test("rectsOverlap is true for two overlapping rectangles", () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, width: 80, height: 80 }, { x: 40, y: 40, width: 80, height: 80 }), true);
});

test("rectsOverlap is false for two separate rectangles", () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, width: 80, height: 80 }, { x: 200, y: 200, width: 80, height: 80 }), false);
});

test("rectsOverlap is false for rectangles that merely touch at the edge", () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, width: 80, height: 80 }, { x: 80, y: 0, width: 80, height: 80 }), false);
});
