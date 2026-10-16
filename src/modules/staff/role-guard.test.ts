import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAccountAction, checkRoleGrant } from "./role-guard";

const manager = { permissions: new Set(["staff.manage", "schedule.edit"]), isOwner: false };
const owner = { permissions: new Set(["staff.manage", "finance.manage", "settings.manage"]), isOwner: true };

test("un responsable ne peut pas donner un droit qu'il n'a pas", () => {
  const r = checkRoleGrant({ actor: manager, target: { currentRoleKey: "FLOOR_STAFF", isSelf: false }, next: { baseRoleKey: "CUSTOM_1", resultingKeys: ["schedule.edit", "finance.manage"] } });
  assert.match(r!, /droits que tu n'as pas/);
});
test("un responsable peut donner des droits qu'il possède", () => {
  assert.equal(
    checkRoleGrant({ actor: manager, target: { currentRoleKey: "FLOOR_STAFF", isSelf: false }, next: { baseRoleKey: "MANAGER", resultingKeys: ["schedule.edit"] } }),
    null
  );
});
test("personne ne modifie son propre rôle, même le propriétaire", () => {
  assert.match(checkRoleGrant({ actor: owner, target: { currentRoleKey: "OWNER", isSelf: true }, next: { baseRoleKey: "OWNER", resultingKeys: [] } })!, /propre rôle/);
});
test("seul le propriétaire touche au compte du propriétaire ou donne ce rôle", () => {
  assert.match(checkRoleGrant({ actor: manager, target: { currentRoleKey: "OWNER", isSelf: false }, next: { baseRoleKey: "MANAGER", resultingKeys: [] } })!, /propriétaire/);
  assert.match(checkRoleGrant({ actor: manager, target: { currentRoleKey: null, isSelf: false }, next: { baseRoleKey: "OWNER", resultingKeys: [] } })!, /propriétaire/);
  assert.equal(checkRoleGrant({ actor: owner, target: { currentRoleKey: "MANAGER", isSelf: false }, next: { baseRoleKey: "OWNER", resultingKeys: ["finance.manage"] } }), null);
});
test("agir sur le compte du propriétaire", () => {
  assert.match(checkAccountAction({ isOwner: false }, { roleKey: "OWNER" })!, /propriétaire/);
  assert.equal(checkAccountAction({ isOwner: false }, { roleKey: "MANAGER" }), null);
  assert.equal(checkAccountAction({ isOwner: true }, { roleKey: "OWNER" }), null);
});
