import { timeToMinutes } from "@/lib/time";
import { normalizePhone } from "@/modules/messaging/phone";
import type { ServiceWindow } from "@/modules/service/spans";

export const MAX_ONLINE_PARTY_SIZE = 10;
export const MAX_DAYS_AHEAD = 90;
const SLOT_STEP_MINUTES = 30;
/// Dernière arrivée possible : une heure avant la fin du service.
const LAST_ARRIVAL_BEFORE_END_MINUTES = 60;
/// Une demande en ligne doit laisser au moins ce délai avant l'heure choisie, le jour même.
export const MIN_LEAD_MINUTES = 60;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/// Heures proposées au client : de l'ouverture de chaque service jusqu'à une heure avant sa
/// fin, par pas d'une demi-heure.
export function bookingSlots(services: ServiceWindow[]): string[] {
  const out = new Set<string>();
  for (const s of services) {
    const start = timeToMinutes(s.startTime);
    const last = timeToMinutes(s.endTime) - LAST_ARRIVAL_BEFORE_END_MINUTES;
    for (let m = start; m <= Math.max(start, last); m += SLOT_STEP_MINUTES) out.add(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return [...out].sort();
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
};

export type BookingRequestResult =
  | {
      ok: true;
      data: { firstName: string; lastName: string; phone: string; email: string | null; partySize: number; date: string; time: string; notes: string | null };
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
    data: { firstName, lastName, phone: input.phone.trim(), email, partySize: input.partySize, date: input.date, time: input.time, notes },
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

/// Heures réellement proposées : le jour même, celles qui laissent encore le délai minimum.
export function selectableSlots(slots: string[], isToday: boolean, now: Date): string[] {
  if (!isToday) return slots;
  const earliest = now.getHours() * 60 + now.getMinutes() + MIN_LEAD_MINUTES;
  return slots.filter((s) => timeToMinutes(s) >= earliest);
}
