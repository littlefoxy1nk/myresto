import { test } from "node:test";
import assert from "node:assert/strict";
import { isModuleEnabled, moduleKeyForHref, parseDisabledModules, serializeDisabledModules } from "./modules";

test("vide = tout est activé", () => {
  assert.equal(isModuleEnabled("", "inventory"), true);
  assert.equal(isModuleEnabled(null, "finance"), true);
});

test("une fonctionnalité désactivée est détectée, les autres restent actives", () => {
  assert.equal(isModuleEnabled("inventory,finance", "inventory"), false);
  assert.equal(isModuleEnabled("inventory,finance", "crm"), true);
});

test("clés inconnues ignorées", () => {
  assert.deepEqual([...parseDisabledModules("inventory, nimporte,  ,crm")].sort(), ["crm", "inventory"]);
});

test("serialize : ordre du catalogue, sans doublon ni clé inconnue", () => {
  assert.equal(serializeDisabledModules(["inventory", "planning", "inventory", "bidon"]), "planning,inventory");
  assert.equal(serializeDisabledModules([]), "");
});

test("moduleKeyForHref : pages de module, sous-pages, pages toujours visibles", () => {
  assert.equal(moduleKeyForHref("/stock"), "inventory");
  assert.equal(moduleKeyForHref("/reservations/nouvelle"), "reservations");
  assert.equal(moduleKeyForHref("/plan-de-salle"), "floorplan");
  assert.equal(moduleKeyForHref("/aujourdhui"), null);
  assert.equal(moduleKeyForHref("/parametres"), null);
  assert.equal(moduleKeyForHref("/mon-espace"), null);
});
