import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBookingAlertEmail, buildGuestConfirmationEmail, placeAddress } from "./emails";

const reservation = { customerName: "Julie Martin", partySize: 4, date: new Date(2026, 10, 20), time: "20:00", specialRequests: "Anniversaire", customerPhone: "0470 12 34 56" };
const place = { name: "La Valaisanne", address: "Rue des Fleurs 12", postalCode: "1000", city: "Bruxelles" };

test("l'adresse est composée sans trous", () => {
  assert.equal(placeAddress(place), "Rue des Fleurs 12, 1000 Bruxelles");
  assert.equal(placeAddress({ name: "x", city: "Namur" }), "Namur");
  assert.equal(placeAddress({ name: "x" }), "");
});

test("l'alerte à l'équipe dit qui, combien, quand, et comment le joindre", () => {
  const mail = buildBookingAlertEmail(reservation, place, "https://app.example/reservations?date=2026-11-20");
  assert.match(mail.subject, /Julie Martin, 4 personnes, 20 nov\. à 20:00 — La Valaisanne/);
  assert.match(mail.text, /vendredi 20 novembre 2026 à 20:00/);
  assert.match(mail.text, /GSM : 0470 12 34 56/);
  assert.match(mail.text, /Remarque du client : Anniversaire/);
  assert.match(mail.text, /https:\/\/app\.example\/reservations\?date=2026-11-20/);
});

test("l'alerte reste valable sans GSM, sans remarque et sans lien", () => {
  const mail = buildBookingAlertEmail({ ...reservation, customerPhone: null, specialRequests: null }, place, null);
  assert.ok(!mail.text.includes("GSM"));
  assert.ok(!mail.text.includes("Remarque"));
  assert.ok(!mail.text.includes("http"));
});

test("la confirmation au client reprend la réservation, l'adresse, et invite à répondre pour annuler", () => {
  const mail = buildGuestConfirmationEmail(reservation, place);
  assert.match(mail.subject, /^Votre réservation chez La Valaisanne est confirmée — vendredi 20 novembre à 20:00$/);
  assert.match(mail.text, /4 personnes/);
  assert.match(mail.text, /Adresse : Rue des Fleurs 12, 1000 Bruxelles/);
  assert.match(mail.text, /Répondez simplement à cet email/);
  assert.match(mail.text, /Votre remarque : Anniversaire/);
});

test("un nom d'établissement piégé ne peut pas casser les en-têtes de l'email", () => {
  const mail = buildGuestConfirmationEmail(reservation, { name: "Chez Paul\r\nBcc: evil@example.com" });
  assert.ok(!/[\r\n]/.test(mail.subject));
});
