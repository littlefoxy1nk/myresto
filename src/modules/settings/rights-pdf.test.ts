import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { PERMISSIONS } from "@/lib/permissions";
import { PERMISSION_EXPLANATIONS, buildRightsPdf, toWinAnsi } from "./rights-pdf";

const allKeys = new Set<string>(PERMISSIONS.map((p) => p.key));

test("chaque droit du catalogue a son explication", () => {
  for (const p of PERMISSIONS) assert.ok(PERMISSION_EXPLANATIONS[p.key], `explication manquante : ${p.key}`);
});

test("toWinAnsi garde les accents et remplace les caractères hors police", () => {
  assert.equal(toWinAnsi("Éléphant œuf — déjà"), "Éléphant œuf — déjà");
  assert.equal(toWinAnsi("Chef ✓ 日本"), "Chef ? ??");
  assert.equal(toWinAnsi("a b"), "a b");
});

test("le PDF généré est un vrai PDF relisible, sur plusieurs pages", async () => {
  const bytes = await buildRightsPdf({
    establishmentName: "Le Petit Comptoir",
    date: new Date(2026, 9, 15),
    roles: [
      { label: "Propriétaire", permissions: allKeys },
      { label: "Responsable de salle (personnalisé)", permissions: new Set(["reservations.view", "floorplan.view"]) },
      { label: "Employé ✓ 日本", permissions: new Set() },
    ],
  });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 2);
  assert.equal(doc.getTitle(), "Droits d'accès - Le Petit Comptoir");
});

test("fonctionne sans aucun rôle", async () => {
  const bytes = await buildRightsPdf({ establishmentName: "X", date: new Date(), roles: [] });
  assert.equal((await PDFDocument.load(bytes)).getPageCount() >= 1, true);
});
