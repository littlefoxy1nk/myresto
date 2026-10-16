import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../generated/prisma";
import { scopeFor } from "./data-export";

/// Garde-fou : chaque table du schéma doit pouvoir être rattachée à un établissement (donc exportée ET supprimée avec lui).
/// Si on ajoute un modèle qui n'a ni establishmentId ni lien vers un parent qui en a un, ce test échoue et le dit.
test("chaque table est rattachée à un établissement, sauf les tables globales ou propres à un compte", () => {
  const GLOBAL = new Set(["Company", "Establishment", "Permission", "User", "PasswordResetToken"]);
  const orphans = Prisma.dmmf.datamodel.models.filter((m) => !GLOBAL.has(m.name) && scopeFor(m.name, "x") === null).map((m) => m.name);
  assert.deepEqual(orphans, []);
});

test("les tables liées passent par leur parent", () => {
  assert.deepEqual(scopeFor("ReservationTable", "e1"), { reservation: { establishmentId: "e1" } });
  assert.deepEqual(scopeFor("Shift", "e1"), { establishmentId: "e1" });
});
