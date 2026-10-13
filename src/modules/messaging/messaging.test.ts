import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone } from "./phone";
import { buildMessageLinks, renderMessage, DEFAULT_TEMPLATES } from "./templates";

test("numéro belge national → format international", () => {
  assert.equal(normalizePhone("0475 12 34 56"), "32475123456");
  assert.equal(normalizePhone("0475/12.34.56"), "32475123456");
});

test("numéro déjà international (+ ou 00)", () => {
  assert.equal(normalizePhone("+32 475 12 34 56"), "32475123456");
  assert.equal(normalizePhone("0032475123456"), "32475123456");
  assert.equal(normalizePhone("+33 6 12 34 56 78"), "33612345678");
});

test("numéro invalide → null", () => {
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone("abc"), null);
  assert.equal(normalizePhone("12"), null);
  assert.equal(normalizePhone("475123456"), null);
});

const vars = { nom: "Dupont", personnes: 4, heure: "19:00", date: "jeudi 15 octobre", restaurant: "Le Petit Comptoir" };

test("renderMessage remplace les variables et accorde le pluriel", () => {
  const out = renderMessage(DEFAULT_TEMPLATES.ask, vars);
  assert.match(out, /Bonjour Dupont/);
  assert.match(out, /4 personnes/);
  assert.match(out, /19:00/);
  assert.equal(renderMessage("{personnes}", { ...vars, personnes: 1 }), "1 personne");
});

test("renderMessage laisse visible une variable inconnue", () => {
  assert.equal(renderMessage("Salut {prenom}", vars), "Salut {prenom}");
});

test("liens : WhatsApp/SMS selon le téléphone, email selon l'adresse", () => {
  const links = buildMessageLinks({ phone: "0475123456", email: "a@b.be", text: "Salut & merci", subject: "Réservation" });
  assert.equal(links.whatsapp, "https://wa.me/32475123456?text=Salut%20%26%20merci");
  assert.match(links.sms!, /^sms:\+32475123456/);
  assert.match(links.email!, /^mailto:a@b\.be\?subject=R%C3%A9servation/);
});

test("liens : rien sans coordonnées", () => {
  const links = buildMessageLinks({ phone: null, email: "", text: "x", subject: "y" });
  assert.deepEqual(links, { whatsapp: null, sms: null, email: null });
});
