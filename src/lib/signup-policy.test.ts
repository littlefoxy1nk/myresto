import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteCodeMatches, signupPolicy } from "./signup-policy";

test("en production sans code configuré : fermé", () => assert.deepEqual(signupPolicy({ NODE_ENV: "production" }), { open: false, requiresCode: false }));
test("en production avec code : ouvert sur invitation", () =>
  assert.deepEqual(signupPolicy({ NODE_ENV: "production", SIGNUP_INVITE_CODE: "abc" }), { open: true, requiresCode: true }));
test("en développement : ouvert", () => assert.deepEqual(signupPolicy({ NODE_ENV: "development" }), { open: true, requiresCode: false }));
test("le code doit correspondre exactement", () => {
  assert.equal(inviteCodeMatches("secret-1", "secret-1"), true);
  assert.equal(inviteCodeMatches(" secret-1 ", "secret-1"), true);
  assert.equal(inviteCodeMatches("secret-2", "secret-1"), false);
  assert.equal(inviteCodeMatches("", "secret-1"), false);
  assert.equal(inviteCodeMatches("x", undefined), false);
});
