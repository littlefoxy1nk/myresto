import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAdminSignup, isPlatformAdminEmail, platformAdminEmails } from "./platform-admin";

const env = { PLATFORM_ADMIN_EMAILS: " Chloe@Example.be, sara@example.be ,", NODE_ENV: "production", ADMIN_INVITE_CODE: "equipe-secret" };

test("la liste d'adresses est nettoyée (espaces, majuscules, virgules en trop)", () => {
  assert.deepEqual([...platformAdminEmails(env)].sort(), ["chloe@example.be", "sara@example.be"]);
  assert.equal(platformAdminEmails({}).size, 0);
});
test("reconnaît une adresse de l'équipe, quelle que soit la casse", () => {
  assert.equal(isPlatformAdminEmail("CHLOE@example.be", env), true);
  assert.equal(isPlatformAdminEmail("ami@example.be", env), false);
  assert.equal(isPlatformAdminEmail(null, env), false);
});
test("une adresse ordinaire n'est pas concernée", () => assert.equal(checkAdminSignup({ email: "ami@x.be", code: "", adminCodeMatches: () => false, env }), null));
test("une adresse de l'équipe exige le code « équipe »", () => {
  assert.match(checkAdminSignup({ email: "sara@example.be", code: "code-des-restos", adminCodeMatches: (c) => c === "equipe-secret", env })!, /équipe/);
  assert.equal(checkAdminSignup({ email: "sara@example.be", code: "equipe-secret", adminCodeMatches: (c) => c === "equipe-secret", env }), null);
});
test("en production sans code « équipe » configuré : fermé ; en développement : ouvert", () => {
  const noCode = { PLATFORM_ADMIN_EMAILS: "sara@example.be" };
  assert.match(checkAdminSignup({ email: "sara@example.be", code: "x", adminCodeMatches: () => true, env: { ...noCode, NODE_ENV: "production" } })!, /réservée/);
  assert.equal(checkAdminSignup({ email: "sara@example.be", code: "x", adminCodeMatches: () => true, env: { ...noCode, NODE_ENV: "development" } }), null);
});

test("les erreurs de format courantes dans PLATFORM_ADMIN_EMAILS sont tolérées", () => {
  const expected = ["chloehamoir@gmail.com", "sara-petlic@hotmail.com"];
  for (const raw of [
    "chloehamoir@gmail.com,sara-petlic@hotmail.com",
    '"chloehamoir@gmail.com,sara-petlic@hotmail.com"',
    "'chloehamoir@gmail.com', 'sara-petlic@hotmail.com'",
    "Chloehamoir@Gmail.com ; sara-petlic@hotmail.com",
    "chloehamoir@gmail.com\nsara-petlic@hotmail.com\n",
    " chloehamoir@gmail.com sara-petlic@hotmail.com,",
  ]) {
    assert.deepEqual([...platformAdminEmails({ PLATFORM_ADMIN_EMAILS: raw })].sort(), expected, raw);
  }
});
