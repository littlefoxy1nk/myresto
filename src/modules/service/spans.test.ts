import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveDuration, nextServiceAfter, overlapsService, serviceAt, type ServiceWindow } from "./spans";

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

test("overlapsService : 19h/90 min n'apparaît que sur le service de 18h", () => {
  const r = { time: "19:00", durationMinutes: 90 };
  assert.equal(overlapsService(r, services[1]), true);
  assert.equal(overlapsService(r, services[2]), false);
});

test("overlapsService : 19h bloquant le service suivant apparaît sur les deux", () => {
  const r = { time: "19:00", durationMinutes: effectiveDuration(90, "19:00", true, services) };
  assert.equal(overlapsService(r, services[1]), true);
  assert.equal(overlapsService(r, services[2]), true);
});
