import { test } from "node:test";
import assert from "node:assert/strict";
import { buildResetEmail, hashResetToken, isResetTokenUsable, newResetToken } from "./password-reset";

test("le lien est aléatoire et la base ne garde que son empreinte", () => {
  const a = newResetToken();
  const b = newResetToken();
  assert.notEqual(a.token, b.token);
  assert.equal(a.token.length, 64);
  assert.notEqual(a.tokenHash, a.token);
  assert.equal(hashResetToken(a.token), a.tokenHash);
});

test("un lien est valable une fois et jusqu'à son expiration", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  assert.equal(isResetTokenUsable({ expiresAt: new Date("2026-10-16T12:30:00Z"), usedAt: null }, now), true);
  assert.equal(isResetTokenUsable({ expiresAt: new Date("2026-10-16T11:59:00Z"), usedAt: null }, now), false);
  assert.equal(isResetTokenUsable({ expiresAt: new Date("2026-10-16T12:30:00Z"), usedAt: now }, now), false);
});

test("l'email contient le lien et rassure en cas d'erreur", () => {
  const mail = buildResetEmail({ firstName: "Chloé", link: "https://x.test/reinitialiser/abc" });
  assert.match(mail.text, /https:\/\/x\.test\/reinitialiser\/abc/);
  assert.match(mail.text, /ignore simplement/);
});
