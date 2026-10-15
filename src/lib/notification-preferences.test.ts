import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOTIFICATION_CATEGORIES,
  categoryOfNotificationType,
  isNotificationMuted,
  parseMuted,
  serializeMuted,
  visibleNotificationCategories,
} from "./notification-preferences";

test("chaque type de notification connu appartient à une catégorie", () => {
  for (const t of [
    "shift_changed", "shift_cancelled", "leave_approved", "leave_rejected", "leave_requested", "replacement_needed",
    "availability_changed", "coverage_requested", "coverage_accepted", "coverage_declined", "reservation_request",
  ]) {
    assert.ok(categoryOfNotificationType(t), `type sans catégorie : ${t}`);
  }
});

test("un type n'appartient qu'à une seule catégorie", () => {
  const all = NOTIFICATION_CATEGORIES.flatMap((c) => [...c.types]);
  assert.equal(new Set(all).size, all.length);
});

test("les catégories proposées dépendent des droits", () => {
  const employee = visibleNotificationCategories(() => false).map((c) => c.key);
  assert.deepEqual(employee, ["my_schedule", "my_leave", "replacements", "coverage_asked"]);

  const manager = visibleNotificationCategories((p) => p === "reservations.edit" || p === "timeoff.manage").map((c) => c.key);
  assert.ok(manager.includes("online_booking"));
  assert.ok(manager.includes("leave_requests"));
  assert.ok(!manager.includes("availability"));
});

test("isNotificationMuted : seulement les catégories coupées", () => {
  assert.equal(isNotificationMuted("online_booking", "reservation_request"), true);
  assert.equal(isNotificationMuted("online_booking", "shift_changed"), false);
  assert.equal(isNotificationMuted("", "shift_changed"), false);
  assert.equal(isNotificationMuted("my_schedule", "type_inconnu"), false);
});

test("parse / serialize : ordre du catalogue, clés inconnues ignorées", () => {
  assert.deepEqual([...parseMuted("online_booking, bidon, my_schedule")].sort(), ["my_schedule", "online_booking"]);
  assert.equal(serializeMuted(["online_booking", "my_schedule", "bidon"]), "my_schedule,online_booking");
});
