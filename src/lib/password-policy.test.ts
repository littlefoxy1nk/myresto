import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePassword } from "./password-policy";

test("trop court", () => assert.match(validatePassword("court1")!, /10 caractères/));
test("trop courant", () => assert.match(validatePassword("MotDePasse123")!, /courant/));
test("un seul caractère répété", () => assert.match(validatePassword("aaaaaaaaaaaa")!, /répéter/));
test("contient l'email", () => assert.match(validatePassword("chloehamoir2026!", { email: "chloehamoir@gmail.com" })!, /email/));
test("contient le nom de l'établissement", () =>
  assert.match(validatePassword("lepetitcomptoir-2026", { name: "Le Petit Comptoir" })!, /établissement/));
test("une phrase longue est acceptée", () => assert.equal(validatePassword("mon chat dort sur le canapé", { email: "a@b.be" }), null));
test("trop long", () => assert.match(validatePassword("x".repeat(201) + "y")!, /maximum/));
