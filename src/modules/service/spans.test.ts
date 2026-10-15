import { test } from "node:test";
import assert from "node:assert/strict";
import { assignService, coversPerService, effectiveDuration, eveningEnd, nextServiceAfter, serviceAt, servicesOfReservation, type ServiceWindow } from "./spans";

const services: ServiceWindow[] = [
  { id: "midi", name: "12h", startTime: "12:00", endTime: "14:30" },
  { id: "s1", name: "18h", startTime: "18:00", endTime: "20:30" },
  { id: "s2", name: "20h30", startTime: "20:30", endTime: "23:00" },
];

test("serviceAt : l'heure tombe dans le bon service, la fin est exclue", () => {
  assert.equal(serviceAt(services, "19:00")?.id, "s1");
  assert.equal(serviceAt(services, "20:30")?.id, "s2");
  assert.equal(serviceAt(services, "16:00"), null);
});

test("nextServiceAfter : 19h → le service de 20h30", () => {
  assert.equal(nextServiceAfter(services, "19:00")?.id, "s2");
});

test("nextServiceAfter : entre deux services → le prochain", () => {
  assert.equal(nextServiceAfter(services, "16:00")?.id, "s1");
});

test("nextServiceAfter : dernier service → aucun", () => {
  assert.equal(nextServiceAfter(services, "21:00"), null);
});

test("effectiveDuration : sans case cochée, durée inchangée", () => {
  assert.equal(effectiveDuration(90, "19:00", false, services), 90);
});

test("effectiveDuration : 19h bloque jusqu'à la fin du service de 20h30 (23h = 240 min)", () => {
  assert.equal(effectiveDuration(90, "19:00", true, services), 240);
});

test("effectiveDuration : sans service suivant, durée inchangée", () => {
  assert.equal(effectiveDuration(90, "21:00", true, services), 90);
});

test("effectiveDuration : ne raccourcit jamais une durée déjà plus longue", () => {
  assert.equal(effectiveDuration(300, "19:00", true, services), 300);
});

// Les trois services du restaurateur : midi à 15h, 18h à 20h30, 20h30 à 22h.
const resto: ServiceWindow[] = [
  { id: "m", name: "Service de midi à 15h", startTime: "12:00", endTime: "15:00" },
  { id: "a", name: "Service de 18h à 20h30", startTime: "18:00", endTime: "20:30" },
  { id: "b", name: "Service de 20h30 à 22h", startTime: "20:30", endTime: "22:00" },
];

test("assignService : une réservation à 21h va directement dans le service de 20h30 à 22h", () => {
  assert.equal(assignService(resto, "21:00")?.id, "b");
  assert.equal(assignService(resto, "19:30")?.id, "a");
  assert.equal(assignService(resto, "12:30")?.id, "m");
});

test("assignService : la frontière appartient au service qui commence (20h30 → second service)", () => {
  assert.equal(assignService(resto, "20:30")?.id, "b");
  assert.equal(assignService(resto, "20:29")?.id, "a");
});

test("assignService : hors de tout service, le plus proche l'emporte", () => {
  assert.equal(assignService(resto, "15:30")?.id, "m"); // 30 min après le midi, 2h30 avant 18h
  assert.equal(assignService(resto, "17:30")?.id, "a");
  assert.equal(assignService(resto, "22:30")?.id, "b"); // après la fermeture
  assert.equal(assignService(resto, "09:00")?.id, "m");
  assert.equal(assignService([], "19:00"), null);
});

test("servicesOfReservation : sans blocage, uniquement son propre service (même si elle déborde sur le suivant)", () => {
  const r = { time: "19:30", spansNextService: false, blocksEvening: false };
  assert.deepEqual(servicesOfReservation(resto, r).map((s) => s.id), ["a"]);
});

test("servicesOfReservation : 'bloquer aussi le service suivant' ajoute le suivant, 'toute la soirée' ajoute les suivants", () => {
  assert.deepEqual(servicesOfReservation(resto, { time: "19:00", spansNextService: true, blocksEvening: false }).map((s) => s.id), ["a", "b"]);
  assert.deepEqual(servicesOfReservation(resto, { time: "19:00", spansNextService: false, blocksEvening: true }).map((s) => s.id), ["a", "b"]);
  // le dernier service n'a pas de suivant
  assert.deepEqual(servicesOfReservation(resto, { time: "21:00", spansNextService: true, blocksEvening: false }).map((s) => s.id), ["b"]);
});

test("coversPerService : chaque réservation comptée une seule fois, annulations et absences exclues", () => {
  const out = coversPerService(resto, [
    { time: "18:30", partySize: 4, status: "confirmed" },
    { time: "19:30", partySize: 6, status: "seated" }, // déborde sur 20h30+ mais reste dans le service de 18h
    { time: "21:00", partySize: 8, status: "new" },
    { time: "21:30", partySize: 2, status: "cancelled" },
    { time: "12:15", partySize: 5, status: "confirmed" },
  ]);
  assert.deepEqual(out.map((x) => [x.service.id, x.covers]), [["m", 5], ["a", 10], ["b", 8]]);
});
