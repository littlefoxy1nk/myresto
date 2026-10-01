import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeShiftDurationHours,
  evaluateShift,
  checkWeeklyLimit,
  isDayGenerallyUnavailable,
  isServiceUnavailable,
  checkAvailability,
  occurrenceAvailabilities,
  computeServiceObjective,
  computeWeekSummaryParts,
  generateScheduleAssignments,
  isGeneratorEligible,
  type GeneratorMember,
  type GeneratorSlot,
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

test("isDayGenerallyUnavailable is false when only some of the day's services are marked unavailable", () => {
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 2, kind: "unavailable", startTime: null, endTime: null, serviceId: "dejeuner" }];
  assert.equal(isDayGenerallyUnavailable(availabilities, 2, ["dejeuner", "diner"]), false);
});

test("isDayGenerallyUnavailable is true once every service running that day is marked unavailable", () => {
  const availabilities: AvailabilityRow[] = [
    { dayOfWeek: 2, kind: "unavailable", startTime: null, endTime: null, serviceId: "dejeuner" },
    { dayOfWeek: 2, kind: "unavailable", startTime: null, endTime: null, serviceId: "diner" },
  ];
  assert.equal(isDayGenerallyUnavailable(availabilities, 2, ["dejeuner", "diner"]), true);
});

test("isServiceUnavailable is true only for the matching service on that weekday", () => {
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 2, kind: "unavailable", startTime: null, endTime: null, serviceId: "dejeuner" }];
  assert.equal(isServiceUnavailable(availabilities, 2, "dejeuner"), true);
  assert.equal(isServiceUnavailable(availabilities, 2, "diner"), false);
  assert.equal(isServiceUnavailable(availabilities, 3, "dejeuner"), false);
});

test("checkAvailability flags a shift whose service is marked unavailable, even without a time range declared", () => {
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 1, kind: "unavailable", startTime: null, endTime: null, serviceId: "diner" }];
  const result = checkAvailability({ startTime: "18:30", endTime: "23:00", serviceId: "diner" }, availabilities);
  assert.equal(result.status, "unavailable");
});

test("checkAvailability ignores a service-scoped unavailability declared for a different service", () => {
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 1, kind: "unavailable", startTime: null, endTime: null, serviceId: "diner" }];
  const result = checkAvailability({ startTime: "11:30", endTime: "14:30", serviceId: "dejeuner" }, availabilities);
  assert.equal(result.status, "ok");
});

test("checkAvailability warns when a shift falls outside the declared usual working pattern", () => {
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 1, kind: "preferred", startTime: null, endTime: null, serviceId: "dejeuner" }];
  const result = checkAvailability({ startTime: "19:00", endTime: "23:00", serviceId: "diner" }, availabilities);
  assert.equal(result.status, "outside_preferred");
});

test("checkAvailability is ok for a shift matching the declared usual working pattern", () => {
  const availabilities: AvailabilityRow[] = [
    { dayOfWeek: 1, kind: "preferred", startTime: null, endTime: null, serviceId: "dejeuner" },
    { dayOfWeek: 1, kind: "preferred", startTime: null, endTime: null, serviceId: "diner" },
  ];
  const result = checkAvailability({ startTime: "19:00", endTime: "23:00", serviceId: "diner" }, availabilities);
  assert.equal(result.status, "ok");
});

test("checkAvailability treats a one-off addition (already filtered in) exactly like the recurring pattern", () => {
  // occurrenceAvailabilities has already reduced the list to this exact date by the
  // time checkAvailability sees it — from here, a one-off row is indistinguishable
  // from a recurring one.
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 6, kind: "preferred", startTime: null, endTime: null, serviceId: "diner", date: "2026-09-19" }];
  const result = checkAvailability({ startTime: "19:00", endTime: "23:00", serviceId: "diner" }, availabilities);
  assert.equal(result.status, "ok");
});

test("occurrenceAvailabilities keeps recurring rows matching the weekday and drops recurring rows for other weekdays", () => {
  const availabilities: AvailabilityRow[] = [
    { dayOfWeek: 6, kind: "preferred", startTime: null, endTime: null, serviceId: "diner" },
    { dayOfWeek: 2, kind: "preferred", startTime: null, endTime: null, serviceId: "diner" },
  ];
  const result = occurrenceAvailabilities(availabilities, 6, "2026-09-19");
  assert.equal(result.length, 1);
  assert.equal(result[0].dayOfWeek, 6);
});

test("occurrenceAvailabilities keeps a one-off row only on its exact date, regardless of weekday match", () => {
  const availabilities: AvailabilityRow[] = [
    { dayOfWeek: 6, kind: "preferred", startTime: null, endTime: null, serviceId: "diner", date: "2026-09-19" },
    { dayOfWeek: 6, kind: "preferred", startTime: null, endTime: null, serviceId: "diner", date: "2026-09-26" },
  ];
  const result = occurrenceAvailabilities(availabilities, 6, "2026-09-19");
  assert.equal(result.length, 1);
  assert.equal(result[0].date, "2026-09-19");
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
    employmentType: "fixe",
    positions: [],
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

const genShift = { startTime: "18:00", endTime: "23:00", serviceId: "dinner" };

test("isGeneratorEligible rejects someone with no declared availability at all — no data is never 'available'", () => {
  assert.equal(isGeneratorEligible(genShift, []), false);
});

test("isGeneratorEligible accepts someone who declared this exact service as usual", () => {
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 1, kind: "preferred", serviceId: "dinner", startTime: null, endTime: null }];
  assert.equal(isGeneratorEligible(genShift, availabilities), true);
});

test("isGeneratorEligible rejects someone who only declared a different service that day", () => {
  const availabilities: AvailabilityRow[] = [{ dayOfWeek: 1, kind: "preferred", serviceId: "lunch", startTime: null, endTime: null }];
  assert.equal(isGeneratorEligible(genShift, availabilities), false);
});

test("isGeneratorEligible rejects someone explicitly marked unavailable for this service, even with a matching preferred row", () => {
  const availabilities: AvailabilityRow[] = [
    { dayOfWeek: 1, kind: "preferred", serviceId: "dinner", startTime: null, endTime: null },
    { dayOfWeek: 1, kind: "unavailable", serviceId: "dinner", startTime: null, endTime: null },
  ];
  assert.equal(isGeneratorEligible(genShift, availabilities), false);
});

function makeGenMember(overrides: Partial<GeneratorMember> = {}): GeneratorMember {
  return { membershipId: "m1", employmentType: "fixe", positions: ["salle"], weeklyTarget: 1, ...overrides };
}

function makeSlot(overrides: Partial<GeneratorSlot> = {}): GeneratorSlot {
  return {
    date: "2026-09-21",
    dayOfWeek: 1,
    serviceId: "dinner",
    startTime: "18:00",
    endTime: "23:00",
    position: "salle",
    required: 1,
    alreadyFilled: 0,
    ...overrides,
  };
}

const alwaysEligible = () => true;

test("generateScheduleAssignments fills an empty slot with the only eligible member", () => {
  const members = [makeGenMember({ membershipId: "m1" })];
  const slots = [makeSlot()];
  const assignments = generateScheduleAssignments({ members, slots, isEligible: alwaysEligible, existingShiftsByMember: {}, existingCountByMember: {} });
  assert.deepEqual(assignments.map((a) => a.membershipId), ["m1"]);
});

test("generateScheduleAssignments never assigns someone without the slot's position", () => {
  const members = [makeGenMember({ membershipId: "m1", positions: ["cuisine"] })];
  const slots = [makeSlot({ position: "salle" })];
  const assignments = generateScheduleAssignments({ members, slots, isEligible: alwaysEligible, existingShiftsByMember: {}, existingCountByMember: {} });
  assert.deepEqual(assignments, []);
});

test("generateScheduleAssignments never assigns someone isEligible rejects", () => {
  const members = [makeGenMember({ membershipId: "m1" })];
  const slots = [makeSlot()];
  const assignments = generateScheduleAssignments({ members, slots, isEligible: () => false, existingShiftsByMember: {}, existingCountByMember: {} });
  assert.deepEqual(assignments, []);
});

test("generateScheduleAssignments prefers a flexijob over a fixe employee on the same slot", () => {
  const members = [
    makeGenMember({ membershipId: "fixe-1", employmentType: "fixe" }),
    makeGenMember({ membershipId: "flexi-1", employmentType: "flexijob" }),
  ];
  const slots = [makeSlot({ required: 1 })];
  const assignments = generateScheduleAssignments({ members, slots, isEligible: alwaysEligible, existingShiftsByMember: {}, existingCountByMember: {} });
  assert.deepEqual(assignments.map((a) => a.membershipId), ["flexi-1"]);
});

test("generateScheduleAssignments picks the fixe employee furthest below their target first", () => {
  const members = [
    makeGenMember({ membershipId: "near-target", weeklyTarget: 4 }),
    makeGenMember({ membershipId: "far-from-target", weeklyTarget: 4 }),
  ];
  const slots = [makeSlot({ required: 1 })];
  const assignments = generateScheduleAssignments({
    members,
    slots,
    isEligible: alwaysEligible,
    existingShiftsByMember: {},
    existingCountByMember: { "near-target": 3, "far-from-target": 0 },
  });
  assert.deepEqual(assignments.map((a) => a.membershipId), ["far-from-target"]);
});

test("generateScheduleAssignments respects alreadyFilled and tops up only what's missing", () => {
  const members = [makeGenMember({ membershipId: "m1" }), makeGenMember({ membershipId: "m2" })];
  const slots = [makeSlot({ required: 2, alreadyFilled: 1 })];
  const assignments = generateScheduleAssignments({ members, slots, isEligible: alwaysEligible, existingShiftsByMember: {}, existingCountByMember: {} });
  assert.equal(assignments.length, 1);
});

test("generateScheduleAssignments never double-books someone already busy at an overlapping time", () => {
  const members = [makeGenMember({ membershipId: "m1" })];
  const slots = [makeSlot()];
  const assignments = generateScheduleAssignments({
    members,
    slots,
    isEligible: alwaysEligible,
    existingShiftsByMember: { m1: [{ date: "2026-09-21", startTime: "17:00", endTime: "22:00" }] },
    existingCountByMember: {},
  });
  assert.deepEqual(assignments, []);
});

test("generateScheduleAssignments rebalances by swapping an over-target fixe for an under-target one", () => {
  // Les deux sont à égalité (0/target) au moment du remplissage initial, donc le tri par
  // ratio (stable) garde l'ordre d'origine et place "a" — qui atteint pile son objectif
  // de 1. "b" (objectif 2) reste à 0, sous son objectif : le rééquilibrage doit lui céder
  // ce créneau, puisque "a" (ratio 1.0) est désormais plus avancé que "b" (ratio 0).
  const members = [makeGenMember({ membershipId: "a", weeklyTarget: 1 }), makeGenMember({ membershipId: "b", weeklyTarget: 2 })];
  const slots = [makeSlot({ required: 1 })];
  const assignments = generateScheduleAssignments({ members, slots, isEligible: alwaysEligible, existingShiftsByMember: {}, existingCountByMember: {} });
  assert.deepEqual(assignments.map((a) => a.membershipId), ["b"]);
});

test("generateScheduleAssignments never swaps a flexijob assignment out during rebalancing", () => {
  const members = [
    makeGenMember({ membershipId: "flexi-1", employmentType: "flexijob" }),
    makeGenMember({ membershipId: "under", weeklyTarget: 2 }),
  ];
  const slot = makeSlot();
  const assignments = generateScheduleAssignments({
    members,
    slots: [slot],
    isEligible: alwaysEligible,
    existingShiftsByMember: {},
    existingCountByMember: {},
  });
  // Un seul créneau, le flexijob le prend en priorité dès le remplissage — rien à
  // rééquilibrer puisque "under" n'a jamais été assigné ici, mais on vérifie que la
  // passe de rééquilibrage ne touche pas à cette affectation pour autant.
  assert.deepEqual(assignments.map((a) => a.membershipId), ["flexi-1"]);
});
