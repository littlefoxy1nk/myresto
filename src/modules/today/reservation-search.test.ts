import { test } from "node:test";
import assert from "node:assert/strict";
import { searchReservations, type ReservationHit } from "./reservation-search";

const t14 = { id: "t14", label: "14", zoneName: "salle arrière" };
const t3 = { id: "t3", label: "3", zoneName: "Salle" };
const items: ReservationHit[] = [
  { id: "a", customerName: "Amélie Fontaine", customerPhone: "+32470000002", time: "19:30", partySize: 2, status: "confirmed", tables: [t14] },
  { id: "b", customerName: "Jean Moreau", customerPhone: "0475 12 34 56", time: "18:00", partySize: 4, status: "new", tables: [t3] },
  { id: "c", customerName: "Karim Bensaid", customerPhone: null, time: "20:00", partySize: 2, status: "cancelled", tables: [] },
  { id: "d", customerName: "Karim Benzema", customerPhone: null, time: "21:00", partySize: 2, status: "confirmed", tables: [] },
];
const ids = (q: string) => searchReservations(items, q).map((i) => i.id);

test("sans saisie : rien", () => assert.deepEqual(ids("  "), []));
test("par nom, sans accents ni majuscules", () => {
  assert.deepEqual(ids("amelie"), ["a"]);
  assert.deepEqual(ids("MOREAU jean"), ["b"]);
});
test("par numéro de table", () => {
  assert.deepEqual(ids("table 14"), ["a"]);
  assert.deepEqual(ids("14"), ["a"]);
});
test("par téléphone, quelle que soit la façon de l'écrire", () => {
  assert.deepEqual(ids("0475 12 34"), ["b"]);
  assert.deepEqual(ids("475123456"), ["b"]);
  assert.deepEqual(ids("+32470000002"), ["a"]);
  assert.deepEqual(ids("0470000002"), ["a"]);
});
test("un seul chiffre ne cherche pas dans les téléphones", () => assert.deepEqual(ids("7"), []));
test("les annulées passent après les autres", () => assert.deepEqual(ids("karim"), ["d", "c"]));
test("tous les mots doivent correspondre", () => assert.deepEqual(ids("karim bensaid"), ["c"]));
