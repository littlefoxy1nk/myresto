import { test } from "node:test";
import assert from "node:assert/strict";
import { ContactSchema, buildSupportEmail, readSmtpConfig, sanitizeHeader } from "./contact";

test("ContactSchema : message valide, titre et message trop courts refusés", () => {
  assert.ok(ContactSchema.safeParse({ category: "probleme", subject: "Plus d'accès", message: "Je n'arrive plus à me connecter." }).success);
  assert.equal(ContactSchema.safeParse({ category: "probleme", subject: "a", message: "Je n'arrive plus à me connecter." }).success, false);
  assert.equal(ContactSchema.safeParse({ category: "probleme", subject: "Titre ok", message: "court" }).success, false);
  assert.equal(ContactSchema.safeParse({ category: "autre", subject: "Titre ok", message: "Un message assez long." }).success, false);
});

test("readSmtpConfig : null si incomplète, port 587 par défaut, SSL sur 465", () => {
  assert.equal(readSmtpConfig({}), null);
  assert.equal(readSmtpConfig({ SMTP_HOST: "smtp.x.be", SMTP_USER: "a@x.be" }), null);
  const cfg = readSmtpConfig({ SMTP_HOST: "smtp.x.be", SMTP_USER: "a@x.be", SMTP_PASS: "secret" });
  assert.deepEqual(cfg, { host: "smtp.x.be", port: 587, secure: false, user: "a@x.be", pass: "secret", from: "a@x.be" });
  assert.equal(readSmtpConfig({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p", SMTP_PORT: "465" })?.secure, true);
});

test("sanitizeHeader retire les retours à la ligne (pas d'injection d'en-têtes)", () => {
  assert.equal(sanitizeHeader("Bonjour\r\nBcc: pirate@x.be"), "Bonjour Bcc: pirate@x.be");
});

test("buildSupportEmail : objet clair, expéditeur et établissement dans le corps", () => {
  const mail = buildSupportEmail({
    category: "probleme",
    subject: "Écran\nbloqué",
    message: "Le plan ne charge pas.",
    userName: "Marc Dubois",
    userEmail: "marc@x.be",
    establishmentName: "Le Petit Comptoir",
    roleLabel: "Gérant",
  });
  assert.equal(mail.subject, "[MYRESTO] J'ai un problème — Écran bloqué");
  assert.match(mail.text, /De : Marc Dubois <marc@x\.be>/);
  assert.match(mail.text, /Établissement : Le Petit Comptoir/);
});
