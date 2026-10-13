import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookingSlots,
  buildAvailability,
  createRateLimiter,
  seatsFreeAt,
  slotsByService,
  validateBookingRequest,
  type BookingRequestInput,
} from "./logic";

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

test("slotsByService : de l'ouverture à la fermeture incluse, une heure commune va au service qui commence", () => {
  const [first, second] = slotsByService(services);
  assert.deepEqual(first.times, ["18:00", "18:30", "19:00", "19:30", "20:00"]);
  assert.deepEqual(second.times, ["20:30", "21:00", "21:30", "22:00", "22:30", "23:00"]);
});

test("bookingSlots : un service 18:00–21:30 propose jusqu'à 21:30, un midi 12–15 jusqu'à 15:00", () => {
  const slots = bookingSlots([
    { id: "m", name: "Midi", startTime: "12:00", endTime: "15:00" },
    { id: "s", name: "Soir", startTime: "18:00", endTime: "21:30" },
  ]);
  assert.equal(slots[0], "12:00");
  assert.ok(slots.includes("15:00"));
  assert.equal(slots[slots.length - 1], "21:30");
  assert.ok(!slots.includes("16:00"));
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
  const r = validateBookingRequest({ ...base, partySize: 7 }, now, open);
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

test("le jour même : au moins 1 h 30 de délai", () => {
  const today = { ...base, date: "2026-10-13" };
  assert.equal(validateBookingRequest({ ...today, time: "19:00" }, new Date(2026, 9, 13, 17, 45), open).ok, false);
  assert.equal(validateBookingRequest({ ...today, time: "19:00" }, new Date(2026, 9, 13, 17, 30), open).ok, true);
});

test("rate limiter : bloque au-delà du maximum puis libère", () => {
  const limiter = createRateLimiter(2, 1000);
  assert.equal(limiter.allow("k", 0), true);
  assert.equal(limiter.allow("k", 10), true);
  assert.equal(limiter.allow("k", 20), false);
  assert.equal(limiter.allow("other", 20), true);
  assert.equal(limiter.allow("k", 2000), true);
});


const party = (time: string, partySize: number, durationMinutes = 90) => ({ time, partySize, durationMinutes });

test("seatsFreeAt : retire les couverts qui se chevauchent seulement", () => {
  const bookings = [party("18:00", 4), party("20:00", 6)];
  assert.equal(seatsFreeAt("18:30", bookings, 20), 16);
  assert.equal(seatsFreeAt("19:30", bookings, 20), 14);
  assert.equal(seatsFreeAt("21:30", bookings, 20), 20);
});

test("buildAvailability : un service sans place pour le groupe est complet, sans créneau", () => {
  const out = buildAvailability({
    services,
    bookings: [party("18:00", 8), party("19:00", 8), party("20:00", 8)],
    totalSeats: 16,
    partySize: 2,
    isToday: false,
    now,
  });
  assert.deepEqual(out[0].times, []);
  assert.equal(out[0].full, true);
  assert.ok(out[1].times.includes("22:00"));
  assert.equal(out[1].full, false);
});

test("buildAvailability : propose seulement les heures où le groupe tient", () => {
  const out = buildAvailability({
    services,
    bookings: [party("18:00", 6)],
    totalSeats: 8,
    partySize: 4,
    isToday: false,
    now,
  });
  assert.ok(!out[0].times.includes("18:00"));
  assert.ok(!out[0].times.includes("19:00"));
  assert.ok(out[0].times.includes("19:30"));
});

test("buildAvailability : le jour même, masque les heures à moins de 1 h 30 sans dire complet", () => {
  const out = buildAvailability({ services, bookings: [], totalSeats: 20, partySize: 2, isToday: true, now: new Date(2026, 9, 13, 19, 0) });
  assert.deepEqual(out[0].times, []);
  assert.equal(out[0].full, false);
  assert.equal(out[1].times[0], "20:30");
});

test("newsletter : la case exige un email", () => {
  assert.equal(validateBookingRequest({ ...base, newsletterOptIn: true }, now, open).ok, false);
  const ok = validateBookingRequest({ ...base, email: "a@b.be", newsletterOptIn: true }, now, open);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.data.newsletterOptIn, true);
});

test("newsletter : jamais présumée", () => {
  const r = validateBookingRequest({ ...base, email: "a@b.be" }, now, open);
  assert.equal(r.ok && r.data.newsletterOptIn, false);
});
