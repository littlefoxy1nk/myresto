import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ONLINE_RULES, clampRules, formatLeadTime, parseClosedTimes, serializeClosedTimes } from "./rules";
import {
  bookingSlots,
  buildAvailability,
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
    date: new Date(2026, 9, 15),
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
    date: new Date(2026, 9, 15),
    now,
  });
  assert.ok(!out[0].times.includes("18:00"));
  assert.ok(!out[0].times.includes("19:00"));
  assert.ok(out[0].times.includes("19:30"));
});

test("buildAvailability : le jour même, masque les heures à moins de 1 h 30 sans dire complet", () => {
  const out = buildAvailability({ services, bookings: [], totalSeats: 20, partySize: 2, date: new Date(2026, 9, 13), now: new Date(2026, 9, 13, 19, 0) });
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

const lunch = { id: "m", name: "Midi", startTime: "12:00", endTime: "14:00" };
const dinner = { id: "d", name: "Soir", startTime: "18:00", endTime: "20:30" };
const day15 = new Date(2026, 9, 15);

test("heures fermées par le restaurateur : absentes des créneaux et refusées à la demande", () => {
  const svc = [{ ...dinner, onlineClosedTimes: ["19:00", "19:30"] }];
  const out = buildAvailability({ services: svc, bookings: [], totalSeats: 20, partySize: 2, date: day15, now });
  assert.deepEqual(out[0].times, ["18:00", "18:30", "20:00", "20:30"]);
  assert.equal(out[0].closedOnline, false);
  assert.equal(validateBookingRequest({ ...base, time: "19:00" }, now, () => svc).ok, false);
  assert.equal(validateBookingRequest({ ...base, time: "18:30" }, now, () => svc).ok, true);
});

test("service fermé en ligne : aucun créneau, marqué fermé (pas complet), et demande refusée", () => {
  const svc = [{ ...lunch, onlineEnabled: false }, dinner];
  const out = buildAvailability({ services: svc, bookings: [], totalSeats: 20, partySize: 2, date: day15, now });
  assert.deepEqual(out[0].times, []);
  assert.equal(out[0].closedOnline, true);
  assert.equal(out[0].full, false);
  assert.ok(out[1].times.length > 0);
  assert.equal(validateBookingRequest({ ...base, time: "12:30" }, now, () => svc).ok, false);
});

test("tous les services fermés en ligne : message dédié, pas « fermé ce jour-là »", () => {
  const r = validateBookingRequest(base, now, () => [{ ...dinner, onlineEnabled: false }]);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /pas de réservation en ligne/);
  const closedDay = validateBookingRequest(base, now, () => []);
  if (!closedDay.ok) assert.match(closedDay.error, /fermé/);
});

test("plafond de couverts en ligne : atteint → complet, sinon encore ouvert ; seuls les couverts en ligne comptent", () => {
  const svc = [{ ...dinner, onlineMaxCovers: 10 }];
  const common = { services: svc, totalSeats: 100, date: day15, now };
  const lots = [{ time: "18:00", durationMinutes: 90, partySize: 40 }];
  // 40 couverts réservés par téléphone : ne comptent pas pour le plafond en ligne.
  const phoneOnly = buildAvailability({ ...common, bookings: lots, onlineBookings: [], partySize: 4 });
  assert.ok(phoneOnly[0].times.length > 0);
  // 8 couverts déjà reçus en ligne : un groupe de 2 passe, un groupe de 4 dépasse le plafond de 10.
  const online = [{ time: "19:00", partySize: 8 }];
  assert.ok(buildAvailability({ ...common, bookings: [], onlineBookings: online, partySize: 2 })[0].times.length > 0);
  const over = buildAvailability({ ...common, bookings: [], onlineBookings: online, partySize: 4 });
  assert.deepEqual(over[0].times, []);
  assert.equal(over[0].full, true);
});

test("plafond de couverts : compté par service, pas pour les autres", () => {
  const svc = [{ ...lunch, onlineMaxCovers: 4 }, dinner];
  const out = buildAvailability({ services: svc, bookings: [], onlineBookings: [{ time: "12:30", partySize: 4 }], totalSeats: 50, partySize: 2, date: day15, now });
  assert.deepEqual(out[0].times, []);
  assert.ok(out[1].times.length > 0);
});

test("taille maximale d'un groupe réglable", () => {
  const rules = { ...DEFAULT_ONLINE_RULES, maxPartySize: 10 };
  assert.equal(validateBookingRequest({ ...base, partySize: 10 }, now, open, rules).ok, true);
  assert.equal(validateBookingRequest({ ...base, partySize: 11 }, now, open, rules).ok, false);
  const small = validateBookingRequest({ ...base, partySize: 3 }, now, open, { ...DEFAULT_ONLINE_RULES, maxPartySize: 2 });
  assert.equal(small.ok, false);
});

test("jusqu'à combien de jours à l'avance : réglable", () => {
  const rules = { ...DEFAULT_ONLINE_RULES, maxDaysAhead: 7 };
  assert.equal(validateBookingRequest({ ...base, date: "2026-10-20" }, now, open, rules).ok, true); // 7 jours
  assert.equal(validateBookingRequest({ ...base, date: "2026-10-21" }, now, open, rules).ok, false); // 8 jours
});

test("délai minimum réglable, aussi sur plusieurs jours", () => {
  const day = { ...base, date: "2026-10-13", time: "19:00" };
  assert.equal(validateBookingRequest(day, new Date(2026, 9, 13, 17, 30), open, { ...DEFAULT_ONLINE_RULES, minLeadMinutes: 60 }).ok, true);
  assert.equal(validateBookingRequest(day, new Date(2026, 9, 13, 18, 30), open, { ...DEFAULT_ONLINE_RULES, minLeadMinutes: 60 }).ok, false);
  const rules24 = { ...DEFAULT_ONLINE_RULES, minLeadMinutes: 1440 };
  // 24 h de préavis : demain 18:00 depuis aujourd'hui 19:00 est trop proche, demain 19:30 passe.
  const late = new Date(2026, 9, 13, 19, 0);
  assert.equal(validateBookingRequest({ ...base, date: "2026-10-14", time: "18:00" }, late, open, rules24).ok, false);
  assert.equal(validateBookingRequest({ ...base, date: "2026-10-14", time: "19:30" }, late, open, rules24).ok, true);
  const out = buildAvailability({ services, bookings: [], totalSeats: 20, partySize: 2, date: new Date(2026, 9, 14), now: late, rules: rules24 });
  assert.ok(!out[0].times.includes("18:00"));
  assert.ok(out[0].times.includes("19:30"));
});

test("sans délai minimum : on peut réserver pour tout de suite", () => {
  const rules = { ...DEFAULT_ONLINE_RULES, minLeadMinutes: 0 };
  assert.equal(validateBookingRequest({ ...base, date: "2026-10-13", time: "18:00" }, new Date(2026, 9, 13, 18, 0), open, rules).ok, true);
});

test("réglages : heures fermées lues et écrites sans doublon ni valeur invalide", () => {
  assert.deepEqual(parseClosedTimes("19:30, 19:00,19:30,abc,25:00,"), ["19:00", "19:30"]);
  assert.deepEqual(parseClosedTimes(""), []);
  assert.equal(serializeClosedTimes(["20:00", "19:00", "20:00"]), "19:00,20:00");
});

test("réglages : les limites restent dans les bornes", () => {
  assert.deepEqual(clampRules({}), DEFAULT_ONLINE_RULES);
  assert.equal(clampRules({ maxPartySize: 500 }).maxPartySize, 20);
  assert.equal(clampRules({ maxPartySize: 0 }).maxPartySize, 1);
  assert.equal(clampRules({ maxDaysAhead: 9999 }).maxDaysAhead, 365);
  assert.equal(clampRules({ minLeadMinutes: -5 }).minLeadMinutes, 0);
});

test("formatLeadTime", () => {
  assert.equal(formatLeadTime(30), "30 min");
  assert.equal(formatLeadTime(90), "1 h 30");
  assert.equal(formatLeadTime(180), "3 h");
  assert.equal(formatLeadTime(1440), "1 jour");
  assert.equal(formatLeadTime(2880), "2 jours");
  assert.equal(formatLeadTime(0), "aucun délai");
});
