import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingSlots, createRateLimiter, selectableSlots, validateBookingRequest, type BookingRequestInput } from "./logic";

const services = [
  { id: "s1", name: "18h", startTime: "18:00", endTime: "20:30" },
  { id: "s2", name: "20h30", startTime: "20:30", endTime: "23:00" },
];
const now = new Date(2026, 9, 13, 10, 0);
const open = () => services;
const base: BookingRequestInput = {
  firstName: "Marie",
  lastName: "Dupont",
  phone: "0475 12 34 56",
  partySize: 2,
  date: "2026-10-15",
  time: "18:00",
};

test("bookingSlots : début de service jusqu'à 1 h avant la fin, par demi-heure", () => {
  assert.deepEqual(bookingSlots(services), [
    "18:00", "18:30", "19:00", "19:30", "20:30", "21:00", "21:30", "22:00",
  ]);
});

test("demande valide", () => {
  const r = validateBookingRequest(base, now, open);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.email, null);
});

test("téléphone obligatoire et valide", () => {
  assert.equal(validateBookingRequest({ ...base, phone: "" }, now, open).ok, false);
  assert.equal(validateBookingRequest({ ...base, phone: "abc" }, now, open).ok, false);
});

test("email facultatif mais validé s'il est donné", () => {
  assert.equal(validateBookingRequest({ ...base, email: "" }, now, open).ok, true);
  assert.equal(validateBookingRequest({ ...base, email: "pas-un-email" }, now, open).ok, false);
  assert.equal(validateBookingRequest({ ...base, email: "a@b.be" }, now, open).ok, true);
});

test("nom et prénom obligatoires", () => {
  assert.equal(validateBookingRequest({ ...base, firstName: " " }, now, open).ok, false);
  assert.equal(validateBookingRequest({ ...base, lastName: "" }, now, open).ok, false);
});

test("groupe trop grand renvoie vers le restaurant", () => {
  const r = validateBookingRequest({ ...base, partySize: 11 }, now, open);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /contacter/);
});

test("date passée, trop lointaine, ou fermé", () => {
  assert.equal(validateBookingRequest({ ...base, date: "2026-10-12" }, now, open).ok, false);
  assert.equal(validateBookingRequest({ ...base, date: "2027-03-01" }, now, open).ok, false);
  assert.equal(validateBookingRequest(base, now, () => []).ok, false);
});

test("heure hors créneaux proposés refusée", () => {
  assert.equal(validateBookingRequest({ ...base, time: "17:00" }, now, open).ok, false);
  assert.equal(validateBookingRequest({ ...base, time: "18:15" }, now, open).ok, false);
});

test("le jour même : au moins 1 h de délai", () => {
  const today = { ...base, date: "2026-10-13" };
  assert.equal(validateBookingRequest({ ...today, time: "18:00" }, new Date(2026, 9, 13, 17, 30), open).ok, false);
  assert.equal(validateBookingRequest({ ...today, time: "18:00" }, new Date(2026, 9, 13, 15, 0), open).ok, true);
});

test("rate limiter : bloque au-delà du maximum puis libère", () => {
  const limiter = createRateLimiter(2, 1000);
  assert.equal(limiter.allow("k", 0), true);
  assert.equal(limiter.allow("k", 10), true);
  assert.equal(limiter.allow("k", 20), false);
  assert.equal(limiter.allow("other", 20), true);
  assert.equal(limiter.allow("k", 2000), true);
});

test("selectableSlots : le jour même, masque les heures trop proches", () => {
  const slots = bookingSlots(services);
  assert.deepEqual(selectableSlots(slots, true, new Date(2026, 9, 13, 18, 45)).slice(0, 2), ["20:30", "21:00"]);
  assert.equal(selectableSlots(slots, false, new Date(2026, 9, 13, 18, 45)).length, slots.length);
});
