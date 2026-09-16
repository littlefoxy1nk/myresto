import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveActiveService, type ServiceDefinitionInput } from "./compute";

/// Ces tests couvrent directement le bug trouvé lors de l'audit final : Aujourd'hui et
/// Mode Service répondaient différemment à "quel service est en cours" au même instant.
/// resolveActiveService est maintenant l'unique source de vérité pour cette question —
/// ces tests protègent ce point précis de régression.

const LUNCH: ServiceDefinitionInput = { name: "Déjeuner", startTime: "11:30", endTime: "14:30", daysOfWeek: [1, 2, 3, 4, 5, 6, 7] };
const DINNER: ServiceDefinitionInput = { name: "Dîner", startTime: "18:30", endTime: "23:00", daysOfWeek: [1, 2, 3, 4, 5, 6, 7] };

function at(hours: number, minutes: number): Date {
  // Mardi 15 septembre 2026 — un jour de semaine ordinaire, présent dans daysOfWeek des
  // deux exemples ci-dessus.
  return new Date(2026, 8, 15, hours, minutes);
}

test("resolveActiveService finds the current service when now falls inside its window", () => {
  const result = resolveActiveService([LUNCH, DINNER], at(12, 41));
  assert.equal(result.current?.name, "Déjeuner");
  // "next" reste indépendant de "current" — le prochain service à venir aujourd'hui,
  // qu'un service soit déjà en cours ou non.
  assert.equal(result.next?.name, "Dîner");
});

test("resolveActiveService reports the next service when none is currently running", () => {
  const result = resolveActiveService([LUNCH, DINNER], at(16, 0));
  assert.equal(result.current, null);
  assert.equal(result.next?.name, "Dîner");
  assert.equal(result.next?.minutesFromNow, 150); // 18:30 - 16:00
});

test("resolveActiveService reports neither current nor next once the day's services are over", () => {
  const result = resolveActiveService([LUNCH, DINNER], at(23, 30));
  assert.equal(result.current, null);
  assert.equal(result.next, null);
});

test("resolveActiveService ignores a service not scheduled on today's weekday, even if the time overlaps", () => {
  const lunchWeekdaysOnly: ServiceDefinitionInput = { ...LUNCH, daysOfWeek: [1, 2, 3, 4, 5] }; // pas le week-end
  const sunday = new Date(2026, 8, 20, 12, 41); // dimanche
  const result = resolveActiveService([lunchWeekdaysOnly], sunday);
  assert.equal(result.current, null);
});

test("resolveActiveService picks the soonest of several upcoming services", () => {
  const brunch: ServiceDefinitionInput = { name: "Brunch", startTime: "10:00", endTime: "11:00", daysOfWeek: [1, 2, 3, 4, 5, 6, 7] };
  const result = resolveActiveService([DINNER, brunch, LUNCH], at(9, 0));
  assert.equal(result.next?.name, "Brunch");
});

test("resolveActiveService returns nothing at all when the establishment has no service definitions", () => {
  const result = resolveActiveService([], at(12, 0));
  assert.equal(result.current, null);
  assert.equal(result.next, null);
});
