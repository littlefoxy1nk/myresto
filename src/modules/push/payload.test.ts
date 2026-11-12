import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPushPayload, safeInternalLink } from "./payload";

test("le texte est raccourci et nettoyé", () => {
  const p = buildPushPayload({ type: "announcement", title: "  Réunion \n lundi ", body: "x".repeat(300), linkHref: "/messages" });
  assert.equal(p.title, "Réunion lundi");
  assert.equal(p.body.length, 140);
  assert.ok(p.body.endsWith("…"));
  assert.equal(p.url, "/messages");
  assert.equal(p.tag, "announcement");
});

test("un lien qui sort de l'appli est remplacé par la page d'accueil", () => {
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
    assert.equal(safeInternalLink(bad), "/aujourdhui");
  }
  assert.equal(safeInternalLink("/planning?week=2026-11-09"), "/planning?week=2026-11-09");
});

test("sans corps ni lien, la notification reste valide", () => {
  const p = buildPushPayload({ type: "shift_changed", title: "Ton horaire a changé" });
  assert.deepEqual(p, { title: "Ton horaire a changé", body: "", url: "/aujourdhui", tag: "shift_changed" });
});
