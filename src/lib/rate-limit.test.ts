import { test } from "node:test";
import assert from "node:assert/strict";
import { nextWindow } from "./rate-limit";

test("nextWindow : autorise jusqu'au maximum, bloque ensuite, puis repart quand la fenêtre est passée", () => {
  let state: { count: number; windowStart: number } | null = null;
  const results: boolean[] = [];
  for (const at of [0, 100, 200, 300]) {
    const step = nextWindow(state, at, 3, 1000);
    state = { count: step.count, windowStart: step.windowStart };
    results.push(step.allowed);
  }
  assert.deepEqual(results, [true, true, true, false]);
  const later = nextWindow(state, 1000, 3, 1000);
  assert.equal(later.allowed, true);
  assert.equal(later.count, 1);
  assert.equal(later.windowStart, 1000);
});

test("nextWindow : la fenêtre ne se prolonge pas quand on insiste", () => {
  const first = nextWindow(null, 0, 1, 1000);
  const blocked = nextWindow({ count: first.count, windowStart: first.windowStart }, 900, 1, 1000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.windowStart, 0);
});
