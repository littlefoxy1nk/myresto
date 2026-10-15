import { test } from "node:test";
import assert from "node:assert/strict";
import { formatHourFr, serviceLabel, serviceRange } from "./service-label";

test("formatHourFr : heures rondes, demi-heures, midi et minuit", () => {
  assert.equal(formatHourFr("18:00"), "18h");
  assert.equal(formatHourFr("09:00"), "9h");
  assert.equal(formatHourFr("20:30"), "20h30");
  assert.equal(formatHourFr("21:05"), "21h05");
  assert.equal(formatHourFr("12:00"), "midi");
  assert.equal(formatHourFr("00:00"), "minuit");
  assert.equal(formatHourFr("12:30"), "12h30");
});

test("les trois services du restaurateur s'appellent par leur horaire", () => {
  assert.equal(serviceLabel("12:00", "15:00"), "Service de midi à 15h");
  assert.equal(serviceLabel("18:00", "20:30"), "Service de 18h à 20h30");
  assert.equal(serviceLabel("20:30", "22:00"), "Service de 20h30 à 22h");
  assert.equal(serviceRange("18:00", "20:30"), "de 18h à 20h30");
});
