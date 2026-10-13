import { timeToMinutes } from "@/lib/time";
import { normalizePhone } from "@/modules/messaging/phone";
import type { ServiceWindow } from "@/modules/service/spans";

/// Au-delà, le client doit appeler le restaurant.
export const MAX_ONLINE_PARTY_SIZE = 6;
export const MAX_DAYS_AHEAD = 90;
const SLOT_STEP_MINUTES = 30;
/// Une demande en ligne doit être faite au moins 1 h 30 avant l'heure choisie ; plus tard, il faut appeler.
export const MIN_LEAD_MINUTES = 90;
/// Durée de table supposée pour une demande en ligne.
export const ONLINE_BOOKING_DURATION_MINUTES = 90;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export type ServiceSlotTimes = { service: ServiceWindow; times: string[] };

/// Créneaux de chaque service : de son ouverture à sa fermeture incluse, par demi-heure
/// (ex : un service 18:00–21:30 propose 18:00 … 21:30). Une heure commune à deux services
/// qui se touchent (20:30) appartient à celui qui commence à cette heure.
export function slotsByService(services: ServiceWindow[]): ServiceSlotTimes[] {
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

/// Toutes les heures proposables un jour donné (tous services confondus).
export function bookingSlots(services: ServiceWindow[]): string[] {
  return slotsByService(services)
    .flatMap((x) => x.times)
    .sort();
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
  servicesForDate: (date: Date) => ServiceWindow[]
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
  if (input.partySize > MAX_ONLINE_PARTY_SIZE) {
    return { ok: false, error: `Au-delà de ${MAX_ONLINE_PARTY_SIZE} personnes, merci de contacter directement le restaurant.` };
  }

  const m = DATE_KEY.exec(input.date);
  if (!m) return { ok: false, error: "Choisis une date." };
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (Number.isNaN(date.getTime()) || date < today) return { ok: false, error: "Cette date est déjà passée." };
  const daysAhead = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (daysAhead > MAX_DAYS_AHEAD) return { ok: false, error: `On ne prend pas encore de réservation à plus de ${MAX_DAYS_AHEAD} jours.` };

  const slots = bookingSlots(servicesForDate(date));
  if (slots.length === 0) return { ok: false, error: "Le restaurant est fermé ce jour-là." };
  if (!slots.includes(input.time)) return { ok: false, error: "Choisis une des heures proposées." };

  if (daysAhead === 0 && timeToMinutes(input.time) < now.getHours() * 60 + now.getMinutes() + MIN_LEAD_MINUTES) {
    return { ok: false, error: "Trop tard pour réserver cette heure en ligne : appelle le restaurant." };
  }

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 300) return { ok: false, error: "Le message est trop long (300 caractères maximum)." };

  return {
    ok: true,
    data: { firstName, lastName, phone: input.phone.trim(), email, partySize: input.partySize, date: input.date, time: input.time, notes, newsletterOptIn: !!input.newsletterOptIn && !!email },
  };
}

/// Fenêtre glissante en mémoire : au plus `max` appels par clé sur `windowMs`. Freine un
/// formulaire public sans dépendance externe ; la mémoire est celle du processus.
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now: number): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
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
  /// Il y avait des heures atteignables en ligne mais plus aucune place : le service est complet.
  full: boolean;
};

/// Ce que le client voit : par service, uniquement les heures qui laissent le délai minimum (le jour même)
/// ET où il reste de la place pour son groupe. Un service sans place est marqué complet.
export function buildAvailability(params: {
  services: ServiceWindow[];
  bookings: BookedParty[];
  totalSeats: number;
  partySize: number;
  isToday: boolean;
  now: Date;
}): ServiceAvailability[] {
  const earliest = params.now.getHours() * 60 + params.now.getMinutes() + MIN_LEAD_MINUTES;
  return slotsByService(params.services).map(({ service, times }) => {
    const reachable = params.isToday ? times.filter((t) => timeToMinutes(t) >= earliest) : times;
    const open = reachable.filter((t) => seatsFreeAt(t, params.bookings, params.totalSeats) >= params.partySize);
    return {
      id: service.id,
      name: service.name,
      startTime: service.startTime,
      endTime: service.endTime,
      times: open,
      full: reachable.length > 0 && open.length === 0,
    };
  });
}
