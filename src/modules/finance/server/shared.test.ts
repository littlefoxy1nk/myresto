import { test } from "node:test";
import assert from "node:assert/strict";
import { ClosingSchema } from "./shared";

/// Protège le contrat de saisie de la clôture de service. Ne couvre pas l'upsert
/// Prisma lui-même (non-duplication par établissement+date+source), qui nécessite une
/// vraie base de données — vérifié manuellement en navigateur, noté comme limite
/// connue dans le rapport de phase plutôt que simulé par un mock fragile.

test("ClosingSchema accepts a well-formed closing", () => {
  const result = ClosingSchema.safeParse({ date: "2026-09-15", revenueCents: 145050, covers: 38 });
  assert.ok(result.success);
});

test("ClosingSchema rejects a negative revenue", () => {
  const result = ClosingSchema.safeParse({ date: "2026-09-15", revenueCents: -100, covers: 10 });
  assert.equal(result.success, false);
});

test("ClosingSchema rejects a negative covers count", () => {
  const result = ClosingSchema.safeParse({ date: "2026-09-15", revenueCents: 1000, covers: -1 });
  assert.equal(result.success, false);
});

test("ClosingSchema rejects a non-integer amount (fractional cents make no sense)", () => {
  const result = ClosingSchema.safeParse({ date: "2026-09-15", revenueCents: 100.5, covers: 10 });
  assert.equal(result.success, false);
});

test("ClosingSchema rejects a malformed date", () => {
  const result = ClosingSchema.safeParse({ date: "15/09/2026", revenueCents: 1000, covers: 10 });
  assert.equal(result.success, false);
});

test("ClosingSchema accepts zero revenue and zero covers (a real, if unusual, closed day)", () => {
  const result = ClosingSchema.safeParse({ date: "2026-09-15", revenueCents: 0, covers: 0 });
  assert.ok(result.success);
});
