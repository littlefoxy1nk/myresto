import { test } from "node:test";
import assert from "node:assert/strict";
import { isEligibleCandidate } from "./compute";
import type { CandidateInput } from "./types";

function candidate(overrides: Partial<CandidateInput> = {}): CandidateInput {
  return {
    membershipId: "m1",
    skills: [],
    hasApprovedLeaveOnDate: false,
    hasOverlappingShift: false,
    ...overrides,
  };
}

test("isEligibleCandidate is true when nothing disqualifies the candidate", () => {
  assert.equal(isEligibleCandidate(candidate(), "salle"), true);
});

test("isEligibleCandidate excludes someone on approved leave that day", () => {
  assert.equal(isEligibleCandidate(candidate({ hasApprovedLeaveOnDate: true }), "salle"), false);
});

test("isEligibleCandidate excludes someone with an overlapping shift", () => {
  assert.equal(isEligibleCandidate(candidate({ hasOverlappingShift: true }), "salle"), false);
});

test("isEligibleCandidate excludes someone whose declared skills don't cover the position", () => {
  assert.equal(isEligibleCandidate(candidate({ skills: ["cuisine"] }), "salle"), false);
});

test("isEligibleCandidate includes someone whose declared skills cover the position", () => {
  assert.equal(isEligibleCandidate(candidate({ skills: ["salle", "bar"] }), "salle"), true);
});

test("isEligibleCandidate does not exclude on an empty skills list — undeclared, not disqualifying", () => {
  assert.equal(isEligibleCandidate(candidate({ skills: [] }), "cuisine"), true);
});
