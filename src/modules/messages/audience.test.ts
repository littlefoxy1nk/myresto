import { test } from "node:test";
import assert from "node:assert/strict";
import { audienceLabel, isAudience, memberInAudience } from "./audience";

test("toute l'équipe : tout le monde, même sans compétence", () => {
  assert.equal(memberInAudience("all", { skills: null }), true);
  assert.equal(memberInAudience("all", { skills: "cuisine" }), true);
});
test("la salle : salle ou bar", () => {
  assert.equal(memberInAudience("salle", { skills: "salle" }), true);
  assert.equal(memberInAudience("salle", { skills: "bar,plonge" }), true);
  assert.equal(memberInAudience("salle", { skills: "cuisine" }), false);
});
test("la cuisine : cuisine ou plonge", () => {
  assert.equal(memberInAudience("cuisine", { skills: "cuisine,bar" }), true);
  assert.equal(memberInAudience("cuisine", { skills: "plonge" }), true);
  assert.equal(memberInAudience("cuisine", { skills: "salle" }), false);
});
test("sans compétence renseignée, on ne devine pas le groupe", () => {
  assert.equal(memberInAudience("salle", { skills: null }), false);
  assert.equal(memberInAudience("cuisine", { skills: "" }), false);
});
test("un public inconnu ne touche personne", () => assert.equal(memberInAudience("tous-les-clients", { skills: "salle" }), false));
test("reconnaît les publics valides et les nomme", () => {
  assert.equal(isAudience("salle"), true);
  assert.equal(isAudience("nimporte"), false);
  assert.equal(audienceLabel("cuisine"), "La cuisine");
});
