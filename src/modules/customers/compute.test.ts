import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCustomerStats } from "./compute";

test("computeCustomerStats counts only seated/completed reservations as visits", () => {
  const stats = computeCustomerStats([
    { date: "2026-01-01", status: "seated" },
    { date: "2026-01-08", status: "completed" },
    { date: "2026-01-15", status: "cancelled" },
    { date: "2026-01-20", status: "new" },
  ]);
  assert.equal(stats.visitCount, 2);
  assert.equal(stats.lastVisitAt, "2026-01-08");
});

test("computeCustomerStats counts no-shows separately from visits", () => {
  const stats = computeCustomerStats([
    { date: "2026-01-01", status: "no_show" },
    { date: "2026-01-08", status: "seated" },
  ]);
  assert.equal(stats.noShowCount, 1);
  assert.equal(stats.visitCount, 1);
});

test("computeCustomerStats returns null lastVisitAt when there is no real visit yet", () => {
  const stats = computeCustomerStats([{ date: "2026-01-01", status: "arrived" }]);
  assert.equal(stats.visitCount, 0);
  assert.equal(stats.lastVisitAt, null);
});
