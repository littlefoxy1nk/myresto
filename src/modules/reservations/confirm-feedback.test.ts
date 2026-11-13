import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmationFeedback } from "./confirm-feedback";

const both = { phone: true, email: true };

test("un email parti est annoncé simplement", () => {
  const f = confirmationFeedback("sent", both);
  assert.match(f.message, /email envoyé/);
  assert.equal(f.tone, "default");
});

test("quand Messages vient de s'ouvrir, on dit d'appuyer sur Envoyer", () => {
  const f = confirmationFeedback(null, { phone: true, email: false }, true);
  assert.match(f.message, /Messages.*Envoyer/);
  assert.equal(f.tone, "default");
});

test("sans email, on dit quoi faire selon ce qu'on a comme contact", () => {
  assert.match(confirmationFeedback("no-email", { phone: true, email: false }).message, /SMS ou WhatsApp/);
  const none = confirmationFeedback("no-email", { phone: false, email: false });
  assert.match(none.message, /pas prévenu/);
  assert.equal(none.tone, "warning");
});

test("un envoi non configuré ou coupé est expliqué, une réservation déjà confirmée ne dit rien de plus", () => {
  assert.match(confirmationFeedback("not-configured", both).message, /pas encore configuré/);
  assert.match(confirmationFeedback("disabled", both).message, /coupés/);
  assert.equal(confirmationFeedback("already-sent", both).message, "Réservation confirmée");
  assert.equal(confirmationFeedback(null, both).message, "Réservation confirmée");
});
