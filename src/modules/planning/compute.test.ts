import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeShiftDurationHours,
  evaluateShift,
  checkWeeklyLimit,
  isDayGenerallyUnavailable,
  computeServiceObjective,
  computeWeekSummaryParts,
} from "./compute";
import type { AvailabilityRow, PlanningAlert, PlanningMember, ServiceObjective } from "./types";

test("computeShiftDurationHours computes a simple evening shift", () => {
  assert.equal(computeShiftDurationHours("18:00", "23:00"), 5);
});

test("computeShiftDurationHours handles a partial-hour shift", () => {
  assert.equal(computeShiftDurationHours("11:30", "14:15"), 2.75);
});

test("evaluateShift flags an approved absence as a conflict", () => {
  const result = evaluateShift(
    { startTime: "18:00", endTime: "23:00" },
    { otherShiftsSameDay: [], isAbsentThatDay: true, availabilities: [] }
  );
  assert.equal(result.level, "conflict");
  assert.ok(result.warnings.some((w) => w.level === "conflict" && /Congé/.test(w.message)));
});

test("evaluateShift flags an overlapping shift as a conflict", () => {
  const result = evaluateShift(
    { startTime: "18:00", endTime: "23:00" },
    { otherShiftsSameDay: [{ startTime: "20:00", endTime: "22:00" }], isAbsentThatDay: false, availabilities: [] }
  );
  assert.equal(result.level, "conflict");
  assert.ok(result.warnings.some((w) => /Chevauche/.test(w.message)));
});

test("evaluateShift treats a violated hard unavailability as a conflict (red)", () => {
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 1, kind: "unavailable", startTime: null, endTime: null }];
  const result = evaluateShift(
    { startTime: "18:00", endTime: "23:00" },
    { otherShiftsSameDay: [], isAbsentThatDay: false, availabilities }
  );
  assert.equal(result.level, "conflict");
});

test("evaluateShift treats a shift outside a soft preference as a warning (orange), not a conflict", () => {
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 1, kind: "preferred", startTime: "10:00", endTime: "15:00" }];
  const result = evaluateShift(
    { startTime: "18:00", endTime: "23:00" },
    { otherShiftsSameDay: [], isAbsentThatDay: false, availabilities }
  );
  assert.equal(result.level, "warning");
  assert.equal(result.warnings[0].level, "warning");
});

test("evaluateShift returns ok when nothing is declared for that day", () => {
  const result = evaluateShift(
    { startTime: "18:00", endTime: "23:00" },
    { otherShiftsSameDay: [], isAbsentThatDay: false, availabilities: [] }
  );
  assert.equal(result.level, "ok");
  assert.deepEqual(result.warnings, []);
});

test("checkWeeklyLimit returns null without a declared max", () => {
  assert.equal(checkWeeklyLimit(10, null), null);
});

test("checkWeeklyLimit returns null below the limit", () => {
  assert.equal(checkWeeklyLimit(2, 5), null);
});

test("checkWeeklyLimit fires once the new shift reaches the limit", () => {
  const message = checkWeeklyLimit(4, 5);
  assert.match(message!, /5\/5/);
});

test("isDayGenerallyUnavailable is true only for a full-day unavailability on that weekday", () => {
  const availabilities: AvailabilityRow[] = [
    { dayOfWeek: 2, kind: "unavailable", startTime: null, endTime: null },
    { dayOfWeek: 3, kind: "unavailable", startTime: "18:00", endTime: "23:00" },
  ];
  assert.equal(isDayGenerallyUnavailable(availabilities, 2), true);
  assert.equal(isDayGenerallyUnavailable(availabilities, 3), false);
  assert.equal(isDayGenerallyUnavailable(availabilities, 4), false);
});

test("computeServiceObjective: atteint once planned meets target", () => {
  const objective = computeServiceObjective(5, 5, [{ dateLabel: "Lundi" }, { dateLabel: "Mardi" }]);
  assert.equal(objective.status, "atteint");
  assert.equal(objective.remaining, 0);
});

test("computeServiceObjective: incomplet when enough compatible slots remain", () => {
  const objective = computeServiceObjective(8, 5, [
    { dateLabel: "Mercredi" },
    { dateLabel: "Mercredi" },
    { dateLabel: "Vendredi" },
  ]);
  assert.equal(objective.status, "incomplet");
  assert.equal(objective.remaining, 3);
  assert.deepEqual(objective.compatibleDayLabels, ["Mercredi", "Vendredi"]);
});

test("computeServiceObjective: impossible when compatible slots fall short of what remains — the worked example from the spec (Chloé)", () => {
  // Chloé vise 8 services, en a déjà 5 de planifiés ; il ne lui reste que 2 créneaux
  // compatibles avec ses contraintes (congé + indisponibilités) pour les 3 qu'il lui manque.
  const objective = computeServiceObjective(8, 5, [{ dateLabel: "Vendredi" }, { dateLabel: "Samedi" }]);
  assert.equal(objective.remaining, 3);
  assert.equal(objective.compatibleSlotsRemaining, 2);
  assert.equal(objective.status, "impossible");
});

test("computeServiceObjective carries the excluded-days breakdown through unchanged — the exact worked example from the phase 2 spec", () => {
  const excludedDays = [
    { dateLabel: "lundi", reason: "indisponible" as const },
    { dateLabel: "mardi", reason: "indisponible" as const },
    { dateLabel: "jeudi", reason: "indisponible" as const },
    { dateLabel: "samedi", reason: "conge" as const },
  ];
  const objective = computeServiceObjective(8, 0, [{ dateLabel: "dimanche" }, { dateLabel: "mercredi" }], excludedDays);
  assert.deepEqual(objective.excludedDays, excludedDays);
});

test("computeServiceObjective defaults excludedDays to an empty array when omitted", () => {
  const objective = computeServiceObjective(5, 5, []);
  assert.deepEqual(objective.excludedDays, []);
});

function makeMember(overrides: Partial<PlanningMember> = {}): PlanningMember {
  return {
    membershipId: "m1",
    firstName: "Chloé",
    lastName: "Hamoir",
    jobTitle: null,
    weeklyHoursTarget: null,
    maxShiftsPerWeek: null,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<PlanningAlert> = {}): PlanningAlert {
  return { id: "alert-1", severity: "watch", title: "titre", ...overrides };
}

test("computeWeekSummaryParts returns nothing when the week is entirely calm", () => {
  assert.deepEqual(computeWeekSummaryParts([], [], {}), []);
});

test("computeWeekSummaryParts counts real conflicts and availability warnings separately", () => {
  const alerts: PlanningAlert[] = [
    makeAlert({ id: "shift-1-Congé approuvé ce jour-là", severity: "urgent" }),
    makeAlert({ id: "shift-2-Chevauche un autre shift ce jour-là", severity: "urgent" }),
    makeAlert({ id: "shift-3-Disponibilité déclarée en dehors", severity: "important" }),
  ];
  const parts = computeWeekSummaryParts(alerts, [], {});
  assert.ok(parts.includes("2 conflits à vérifier"));
  assert.ok(parts.includes("1 disponibilité non respectée"));
});

test("computeWeekSummaryParts counts weekly-limit and no-staff alerts by their id prefix", () => {
  const alerts: PlanningAlert[] = [
    makeAlert({ id: "weekly-limit-m1", severity: "important" }),
    makeAlert({ id: "no-staff-2026-09-15-s1", severity: "urgent" }),
  ];
  const parts = computeWeekSummaryParts(alerts, [], {});
  assert.ok(parts.includes("1 limite hebdomadaire atteinte"));
  assert.ok(parts.includes("1 service sans personnel planifié"));
});

test("computeWeekSummaryParts names up to 2 incomplete objectives, then aggregates the rest", () => {
  const members = [
    makeMember({ membershipId: "m1", firstName: "Chloé" }),
    makeMember({ membershipId: "m2", firstName: "Marc" }),
    makeMember({ membershipId: "m3", firstName: "Julie" }),
  ];
  const objective: ServiceObjective = {
    target: 8,
    planned: 6,
    remaining: 2,
    compatibleSlotsRemaining: 3,
    compatibleDayLabels: ["dimanche"],
    excludedDays: [],
    status: "incomplet",
  };
  const objectivesByMember = { m1: objective, m2: objective, m3: objective };
  const parts = computeWeekSummaryParts([], members, objectivesByMember);
  assert.ok(parts.includes("Chloé : 6/8 services"));
  assert.ok(parts.includes("Marc : 6/8 services"));
  assert.ok(parts.includes("1 autre objectif incomplet"));
});

test("computeWeekSummaryParts never mentions an objective that is already atteint", () => {
  const members = [makeMember()];
  const objective: ServiceObjective = {
    target: 5,
    planned: 5,
    remaining: 0,
    compatibleSlotsRemaining: 0,
    compatibleDayLabels: [],
    excludedDays: [],
    status: "atteint",
  };
  const parts = computeWeekSummaryParts([], members, { m1: objective });
  assert.deepEqual(parts, []);
});
