import { test } from "node:test";
import assert from "node:assert/strict";
import { searchPalette, type PaletteEntry } from "./palette-search";

const entries: PaletteEntry[] = [
  { href: "/aujourdhui", label: "Aujourd'hui", icon: "Sun" },
  { href: "/reservations", label: "Réservations", icon: "CalendarClock", keywords: "resa tables" },
  { href: "/reservations/nouvelle", label: "Nouvelle réservation", icon: "Plus" },
  { href: "/equipe", label: "Équipe", icon: "Users", keywords: "employes personnel" },
];

test("sans saisie, tout s'affiche dans l'ordre du menu", () => {
  assert.equal(searchPalette(entries, "  ").length, 4);
});

test("ignore accents, majuscules et apostrophes", () => {
  assert.deepEqual(searchPalette(entries, "AUJOURD hui").map((e) => e.href), ["/aujourdhui"]);
  assert.deepEqual(searchPalette(entries, "equipe").map((e) => e.href), ["/equipe"]);
});

test("trouve par mot-clé", () => {
  assert.deepEqual(searchPalette(entries, "personnel").map((e) => e.href), ["/equipe"]);
});

test("le libellé qui commence par la saisie passe devant", () => {
  assert.deepEqual(searchPalette(entries, "reserv").map((e) => e.href), ["/reservations", "/reservations/nouvelle"]);
});

test("tous les mots doivent correspondre", () => {
  assert.deepEqual(searchPalette(entries, "nouvelle reservation").map((e) => e.href), ["/reservations/nouvelle"]);
  assert.deepEqual(searchPalette(entries, "equipe finances"), []);
});
