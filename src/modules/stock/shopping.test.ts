import { test } from "node:test";
import assert from "node:assert/strict";
import { listToText, parseItemLines, sortItems } from "./shopping";

test("parseItemLines : une ligne = un article, puces et lignes vides ignorées", () => {
  assert.deepEqual(parseItemLines("céleri\n- carottes\n\n• 6 kg angus\n  * oignons  \n"), [
    "céleri",
    "carottes",
    "6 kg angus",
    "oignons",
  ]);
});

test("parseItemLines : une seule ligne, texte libre conservé", () => {
  assert.deepEqual(parseItemLines("6kg angus, haché"), ["6kg angus, haché"]);
});

test("parseItemLines : vide → rien", () => {
  assert.deepEqual(parseItemLines("  \n \n"), []);
});

test("parseItemLines : longueur et nombre bornés", () => {
  assert.equal(parseItemLines("x".repeat(500))[0].length, 120);
  assert.equal(parseItemLines(Array.from({ length: 200 }, (_, i) => `a${i}`).join("\n")).length, 60);
});

test("listToText : seulement ce qu'il reste à acheter", () => {
  assert.equal(
    listToText("Metro", [
      { label: "céleri", checked: false },
      { label: "carottes", checked: true },
      { label: "6 kg angus", checked: false },
    ]),
    "Metro\n- céleri\n- 6 kg angus"
  );
  assert.equal(listToText("Boucher", [{ label: "x", checked: true }]), "Boucher\n(rien à acheter)");
});

test("sortItems : non cochés d'abord, ordre conservé", () => {
  const out = sortItems([
    { id: 1, checked: true },
    { id: 2, checked: false },
    { id: 3, checked: true },
    { id: 4, checked: false },
  ]);
  assert.deepEqual(out.map((i) => i.id), [2, 4, 1, 3]);
});
