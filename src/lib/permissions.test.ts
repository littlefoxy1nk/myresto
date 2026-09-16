import { test } from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS, SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS } from "./permissions";

/// Le catalogue de permissions est la seule source de vérité du RBAC (voir
/// provision-establishment.ts) — une faute de frappe ici accorderait ou retirerait
/// silencieusement un droit à un rôle entier. Ces tests ne remplacent pas une vraie
/// vérification RBAC de bout en bout (qui demanderait une session et une base de
/// données réelles, hors de portée des tests unitaires actuels — voir le rapport de
/// phase), mais ils garantissent que la matrice elle-même reste cohérente.

test("every permission key referenced in DEFAULT_ROLE_PERMISSIONS actually exists in PERMISSIONS", () => {
  const knownKeys = new Set(PERMISSIONS.map((p) => p.key));
  for (const role of SYSTEM_ROLES) {
    for (const key of DEFAULT_ROLE_PERMISSIONS[role]) {
      assert.ok(knownKeys.has(key), `${role} references unknown permission "${key}"`);
    }
  }
});

test("PERMISSIONS has no duplicate keys", () => {
  const keys = PERMISSIONS.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("OWNER and DIRECTOR always hold every permission — they must never fall behind when a new permission is added", () => {
  const allKeys = PERMISSIONS.map((p) => p.key).sort();
  assert.deepEqual([...DEFAULT_ROLE_PERMISSIONS.OWNER].sort(), allKeys);
  assert.deepEqual([...DEFAULT_ROLE_PERMISSIONS.DIRECTOR].sort(), allKeys);
});

test("every system role has both a permission list and a display label", () => {
  for (const role of SYSTEM_ROLES) {
    assert.ok(role in DEFAULT_ROLE_PERMISSIONS, `${role} is missing from DEFAULT_ROLE_PERMISSIONS`);
    assert.ok(role in ROLE_LABELS, `${role} is missing from ROLE_LABELS`);
  }
});

test("finance.manage exists and is granted to at least one non-owner role", () => {
  assert.ok(PERMISSIONS.some((p) => p.key === "finance.manage"));
  const nonOwnerRoles = SYSTEM_ROLES.filter((r) => r !== "OWNER" && r !== "DIRECTOR");
  assert.ok(nonOwnerRoles.some((r) => DEFAULT_ROLE_PERMISSIONS[r].includes("finance.manage")));
});
