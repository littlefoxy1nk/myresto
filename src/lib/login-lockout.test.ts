import { test } from "node:test";
import assert from "node:assert/strict";
import { isLockedOut, computeFailedAttempt, MAX_FAILED_ATTEMPTS } from "./login-lockout";

test("isLockedOut is false when there is no lockedUntil", () => {
  assert.equal(isLockedOut(null, new Date()), false);
});

test("isLockedOut is true while lockedUntil is in the future", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const lockedUntil = new Date("2026-01-01T12:05:00Z");
  assert.equal(isLockedOut(lockedUntil, now), true);
});

test("isLockedOut is false once lockedUntil is in the past", () => {
  const now = new Date("2026-01-01T12:10:00Z");
  const lockedUntil = new Date("2026-01-01T12:05:00Z");
  assert.equal(isLockedOut(lockedUntil, now), false);
});

test("computeFailedAttempt increments the counter without locking below the threshold", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const result = computeFailedAttempt(1, now);
  assert.equal(result.failedLoginAttempts, 2);
  assert.equal(result.lockedUntil, null);
});

test("computeFailedAttempt locks once the threshold is reached", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const result = computeFailedAttempt(MAX_FAILED_ATTEMPTS - 1, now);
  assert.equal(result.failedLoginAttempts, MAX_FAILED_ATTEMPTS);
  assert.ok(result.lockedUntil);
  assert.ok(result.lockedUntil!.getTime() > now.getTime());
});
