import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMailtoLink,
  DEFAULT_WELCOME_BODY,
  normalizeReviewUrl,
  renderMail,
  reviewBlock,
} from "./mail";

const vars = {
  prenom: "Marie",
  nom: "Dupont",
  restaurant: "Le Petit Comptoir",
  avis: "AVIS\n",
  desinscription: "https://x.be/desinscription/abc",
};

test("renderMail remplit le modèle par défaut", () => {
  const out = renderMail(DEFAULT_WELCOME_BODY, vars);
  assert.match(out, /Bonjour Marie/);
  assert.match(out, /date d'anniversaire/);
  assert.match(out, /GSM/);
  assert.match(out, /https:\/\/x\.be\/desinscription\/abc/);
  assert.doesNotMatch(out, /\{/);
});

test("renderMail laisse visible une variable inconnue", () => {
  assert.equal(renderMail("Salut {surnom}", vars), "Salut {surnom}");
});

test("reviewBlock : un lien par plateforme, vide sans lien", () => {
  assert.equal(reviewBlock({}), "");
  assert.match(reviewBlock({ google: "https://g.co/r" }), /Google : https:\/\/g\.co\/r/);
  const both = reviewBlock({ google: "https://g.co/r", tripadvisor: "https://tripadvisor.be/x" });
  assert.match(both, /TripAdvisor/);
});

test("buildMailtoLink encode objet et corps", () => {
  const link = buildMailtoLink({ to: "a@b.be", subject: "Merci & à bientôt", body: "Ligne 1\nLigne 2" });
  assert.equal(link, "mailto:a@b.be?subject=Merci%20%26%20%C3%A0%20bient%C3%B4t&body=Ligne%201%0ALigne%202");
});

test("normalizeReviewUrl : vide → null, schéma ajouté, http(s) seulement", () => {
  assert.equal(normalizeReviewUrl(""), null);
  assert.equal(normalizeReviewUrl(null), null);
  assert.equal(normalizeReviewUrl("g.page/r/abc"), "https://g.page/r/abc");
  assert.equal(normalizeReviewUrl(" https://www.tripadvisor.be/x "), "https://www.tripadvisor.be/x");
  assert.throws(() => normalizeReviewUrl("javascript:alert(1)"));
  assert.throws(() => normalizeReviewUrl("pas un lien"));
});
