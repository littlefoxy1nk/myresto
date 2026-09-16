import { test } from "node:test";
import assert from "node:assert/strict";
import { slugifyForUsername, baseUsername } from "./username";

test("slugifyForUsername strips accents and lowercases", () => {
  assert.equal(slugifyForUsername("Chloé"), "chloe");
  assert.equal(slugifyForUsername("François"), "francois");
});

test("slugifyForUsername removes spaces, apostrophes, and hyphens", () => {
  assert.equal(slugifyForUsername("Jean-Pierre"), "jeanpierre");
  assert.equal(slugifyForUsername("O'Brien"), "obrien");
  assert.equal(slugifyForUsername("Marie Claire"), "marieclaire");
});

test("baseUsername joins first and last name with a dot", () => {
  assert.equal(baseUsername("Chloé", "Dupont"), "chloe.dupont");
});
