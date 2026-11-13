import { timeToMinutes } from "@/lib/time";
import { normalizePhone } from "@/modules/messaging/phone";
import type { ServiceWindow } from "@/modules/service/spans";
import { DEFAULT_ONLINE_RULES, formatDaysAhead, formatLeadTime, type OnlineRules, type OnlineServiceRule } from "@/modules/booking/rules";

const SLOT_STEP_MINUTES = 30;
/// Durée de table supposée pour une demande en ligne.
export const ONLINE_BOOKING_DURATION_MINUTES = 90;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/// Un service tel que le client le voit en ligne : ses horaires, plus ce que le restaurateur a réglé (ouvert ou non, heures fermées, plafond).
export type BookableService = ServiceWindow & OnlineServiceRule;

export type ServiceSlotTimes<T extends ServiceWindow = ServiceWindow> = { service: T; times: string[] };

/// Créneaux de chaque service : de son ouverture à sa fermeture incluse, par demi-heure
/// (ex : un service 18:00–21:30 propose 18:00 … 21:30). Une heure commune à deux services
/// qui se touchent (20:30) appartient à celui qui commence à cette heure.
export function slotsByService<T extends ServiceWindow>(services: T[]): ServiceSlotTimes<T>[] {
  const ordered = [...services].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const owner = new Map<number, string>();
  for (const s of ordered) {
    for (let m = timeToMinutes(s.startTime); m <= timeToMinutes(s.endTime); m += SLOT_STEP_MINUTES) owner.set(m, s.id);
  }
  return ordered.map((service) => ({
    service,
    times: [...owner.entries()]
      .filter(([, id]) => id === service.id)
      .map(([m]) => m)
      .sort((a, b) => a - b)
      .map((m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`),
  }));
}

/// Les heures d'un service que le restaurateur laisse ouvertes en ligne (aucune si le service est fermé en ligne).
function openTimes(service: BookableService, times: string[]): string[] {
  if (service.onlineEnabled === false) return [];
  const closed = new Set(service.onlineClosedTimes ?? []);
  return times.filter((t) => !closed.has(t));
}

/// Toutes les heures proposables un jour donné (tous services confondus), sans celles que le restaurateur a fermées.
export function bookingSlots(services: BookableService[]): string[] {
  return slotsByService(services)
    .flatMap((x) => openTimes(x.service, x.times))
    .sort();
}

/// Heure de début du créneau demandé, comme date locale (pour mesurer le délai depuis maintenant).
function slotStart(date: Date, time: string): Date {
  const minutes = timeToMinutes(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60);
}

/// Le créneau laisse-t-il assez de temps au restaurant ? (délai minimum réglé par le restaurateur)
function leavesEnoughNotice(date: Date, time: string, now: Date, rules: OnlineRules): boolean {
  return slotStart(date, time).getTime() - now.getTime() >= rules.minLeadMinutes * 60_000;
}

export type BookingRequestInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  partySize: number;
  date: string;
  time: string;
  notes?: string;
  /// Accord explicite (case cochée) pour recevoir les infos du restaurant par email.
  newsletterOptIn?: boolean;
};

export type BookingRequestResult =
  | {
      ok: true;
      data: { firstName: string; lastName: string; phone: string; email: string | null; partySize: number; date: string; time: string; notes: string | null; newsletterOptIn: boolean };
    }
  | { ok: false; error: string };

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/// Valide une demande de réservation en ligne. `servicesForDate` = les services qui tournent
/// ce jour-là (l'appelant les filtre par jour de semaine) : sans service, le restaurant est fermé.
export function validateBookingRequest(
  input: BookingRequestInput,
  now: Date,
  servicesForDate: (date: Date) => BookableService[],
  rules: OnlineRules = DEFAULT_ONLINE_RULES
): BookingRequestResult {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) return { ok: false, error: "Indique ton prénom et ton nom." };
  if (firstName.length > 60 || lastName.length > 60) return { ok: false, error: "Le nom est trop long." };

  if (!normalizePhone(input.phone)) return { ok: false, error: "Indique un numéro de GSM valide (ex : 0475 12 34 56)." };

  const email = input.email?.trim() || null;
  if (email && !EMAIL.test(email)) return { ok: false, error: "Cette adresse email ne semble pas valide." };

  if (input.newsletterOptIn && !email) return { ok: false, error: "Indique ton email pour recevoir les infos du restaurant." };

  if (!Number.isInteger(input.partySize) || input.partySize < 1) return { ok: false, error: "Indique le nombre de personnes." };
  if (input.partySize > rules.maxPartySize) {
    return { ok: false, error: `Au-delà de ${rules.maxPartySize} personne${rules.maxPartySize > 1 ? "s" : ""}, merci de contacter directement le restaurant.` };
  }

  const m = DATE_KEY.exec(input.date);
  if (!m) return { ok: false, error: "Choisis une date." };
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (Number.isNaN(date.getTime()) || date < today) return { ok: false, error: "Cette date est déjà passée." };
  const daysAhead = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (daysAhead > rules.maxDaysAhead) {
    return { ok: false, error: `On ne prend pas de réservation en ligne à plus de ${formatDaysAhead(rules.maxDaysAhead)} à l'avance.` };
  }

  const services = servicesForDate(date);
  if (services.length === 0) return { ok: false, error: "Le restaurant est fermé ce jour-là." };
  const slots = bookingSlots(services);
  if (slots.length === 0) return { ok: false, error: "Ce jour-là, le restaurant ne prend pas de réservation en ligne : appelle-le." };
  if (!slots.includes(input.time)) return { ok: false, error: "Choisis une des heures proposées." };

  if (!leavesEnoughNotice(date, input.time, now, rules)) {
    return {
      ok: false,
      error:
        rules.minLeadMinutes >= 1440
          ? `Il faut réserver au moins ${formatLeadTime(rules.minLeadMinutes)} à l'avance : appelle le restaurant pour une réservation plus proche.`
          : "Trop tard pour réserver cette heure en ligne : appelle le restaurant.",
    };
  }

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 300) return { ok: false, error: "Le message est trop long (300 caractères maximum)." };

  return {
    ok: true,
    data: { firstName, lastName, phone: input.phone.trim(), email, partySize: input.partySize, date: input.date, time: input.time, notes, newsletterOptIn: !!input.newsletterOptIn && !!email },
  };
}

/// Une réservation déjà prise (même celle d'une demande en ligne sans table) qui consomme des places.
export type BookedParty = { time: string; durationMinutes: number; partySize: number };

/// Places encore libres à une heure donnée : places totales moins les couverts des réservations
/// qui se chevauchent avec la durée d'une demande en ligne.
export function seatsFreeAt(time: string, bookings: BookedParty[], totalSeats: number): number {
  const start = timeToMinutes(time);
  const end = start + ONLINE_BOOKING_DURATION_MINUTES;
  const taken = bookings
    .filter((b) => timeToMinutes(b.time) < end && timeToMinutes(b.time) + b.durationMinutes > start)
    .reduce((sum, b) => sum + b.partySize, 0);
  return totalSeats - taken;
}

export type ServiceAvailability = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  /// Heures encore réservables pour ce nombre de personnes.
  times: string[];
  /// Il y avait des heures atteignables en ligne mais plus aucune place (ou le plafond de couverts en ligne est atteint) : complet.
  full: boolean;
  /// Le restaurateur ne propose pas ce service (ou toutes ses heures) en ligne.
  closedOnline: boolean;
};

/// Une demande en ligne déjà prise : seule la table des couverts en ligne compte pour le plafond du restaurateur.
export type OnlineBooked = { time: string; partySize: number };

/// Ce que le client voit : par service, uniquement les heures que le restaurateur laisse ouvertes, qui respectent son délai
/// minimum, où il reste de la place pour le groupe, et tant que son plafond de couverts en ligne n'est pas atteint.
export function buildAvailability(params: {
  services: BookableService[];
  bookings: BookedParty[];
  /// Demandes déjà reçues en ligne ce jour-là (pour le plafond de couverts par service). Vide = aucune.
  onlineBookings?: OnlineBooked[];
  totalSeats: number;
  partySize: number;
  /// Le jour demandé (minuit, heure locale).
  date: Date;
  now: Date;
  rules?: OnlineRules;
}): ServiceAvailability[] {
  const rules = params.rules ?? DEFAULT_ONLINE_RULES;
  const slots = slotsByService(params.services);
  // Chaque heure appartient à un seul service : c'est lui qui voit ses couverts en ligne compter.
  const serviceOfTime = new Map<string, string>();
  for (const { service, times } of slots) for (const t of times) serviceOfTime.set(t, service.id);
  const onlineCovers = new Map<string, number>();
  for (const b of params.onlineBookings ?? []) {
    const id = serviceOfTime.get(b.time);
    if (id) onlineCovers.set(id, (onlineCovers.get(id) ?? 0) + b.partySize);
  }

  return slots.map(({ service, times }) => {
    const base = { id: service.id, name: service.name, startTime: service.startTime, endTime: service.endTime };
    const offered = openTimes(service, times);
    if (offered.length === 0) return { ...base, times: [], full: false, closedOnline: true };

    const reachable = offered.filter((t) => leavesEnoughNotice(params.date, t, params.now, rules));
    const cap = service.onlineMaxCovers ?? null;
    const capReached = cap !== null && (onlineCovers.get(service.id) ?? 0) + params.partySize > cap;
    const open = capReached ? [] : reachable.filter((t) => seatsFreeAt(t, params.bookings, params.totalSeats) >= params.partySize);
    return { ...base, times: open, full: reachable.length > 0 && open.length === 0, closedOnline: false };
  });
}
