import { test } from "node:test";
import assert from "node:assert/strict";
import { initialReservationState } from "./status";

test("une réservation notée à la main est déjà confirmée : rien à confirmer, aucun message à envoyer", () => {
  assert.deepEqual(initialReservationState("manual"), { status: "confirmed", confirmationState: "confirmed" });
});

test("une demande en ligne attend la confirmation du restaurateur", () => {
  assert.deepEqual(initialReservationState("online"), { status: "new", confirmationState: "none" });
});
