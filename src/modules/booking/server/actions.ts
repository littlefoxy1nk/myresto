"use server";

import { randomBytes } from "node:crypto";
import { getClientIp } from "@/lib/client-ip";
import { revalidatePath } from "next/cache";
import { endOfDay, format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { isoWeekday } from "@/lib/time";
import { requirePermission } from "@/lib/current-context";
import { normalizePhone } from "@/modules/messaging/phone";
import { subscribeCustomer } from "@/modules/newsletter/server/subscribe";
import { notifyMember } from "@/modules/myspace/server/notify";
import {
  buildAvailability,
  createRateLimiter,
  MAX_ONLINE_PARTY_SIZE,
  validateBookingRequest,
  type BookingRequestInput,
  type ServiceAvailability,
} from "@/modules/booking/logic";

const HOUR = 3_600_000;
const perPhone = createRateLimiter(3, HOUR);
const perIp = createRateLimiter(10, HOUR);
const perIpAvailability = createRateLimiter(120, HOUR);

/// Places totales (tables utilisables) et couverts déjà pris ce jour-là — y compris les demandes
/// en ligne pas encore installées, qui n'ont pas de table mais occupent bien des places.
async function loadCapacity(establishmentId: string, date: Date) {
  const [tables, reservations] = await Promise.all([
    prisma.restaurantTable.findMany({ where: { establishmentId, status: { not: "unavailable" } }, select: { capacity: true } }),
    prisma.reservation.findMany({
      where: {
        establishmentId,
        date: { gte: startOfDay(date), lte: endOfDay(date) },
        status: { in: ["new", "confirmed", "arrived", "seated"] },
      },
      select: { time: true, durationMinutes: true, partySize: true },
    }),
  ]);
  return { totalSeats: tables.reduce((sum, t) => sum + t.capacity, 0), bookings: reservations };
}

function servicesOn(services: { id: string; name: string; startTime: string; endTime: string; daysOfWeek: string }[], date: Date) {
  const weekday = isoWeekday(date);
  return services
    .filter((s) => s.daysOfWeek.split(",").map(Number).includes(weekday))
    .map((s) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime }));
}

/// Heures encore réservables, par service, pour un jour et un nombre de personnes — un service
/// plein ne propose plus aucun créneau. Public : ne renvoie que des heures, jamais de données internes.
export async function getBookingAvailability(
  slug: string,
  dateKey: string,
  partySize: number
): Promise<{ ok: true; services: ServiceAvailability[] } | { ok: false; error: string }> {
  const ip = await getClientIp();
  if (!perIpAvailability.allow(ip, Date.now())) return { ok: false, error: "Trop de recherches, réessaie dans un instant." };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isInteger(partySize) || partySize < 1 || partySize > MAX_ONLINE_PARTY_SIZE) {
    return { ok: true, services: [] };
  }
  const establishment = await prisma.establishment.findFirst({
    where: { bookingSlug: slug, onlineBookingEnabled: true },
    include: { services: true },
  });
  if (!establishment) return { ok: false, error: "Ce lien de réservation n'est plus actif." };

  const date = new Date(`${dateKey}T00:00:00`);
  const now = new Date();
  const { totalSeats, bookings } = await loadCapacity(establishment.id, date);
  return {
    ok: true,
    services: buildAvailability({
      services: servicesOn(establishment.services, date),
      bookings,
      totalSeats,
      partySize,
      isToday: startOfDay(date).getTime() === startOfDay(now).getTime(),
      now,
    }),
  };
}

export type BookingSubmitResult = { ok: true } | { ok: false; error: string };

/// Formulaire PUBLIC (aucune connexion) : crée une demande de réservation "nouvelle", sans table,
/// source "online". Le restaurant la traite ensuite : il choisit une table, confirme, puis prévient
/// le client. Protections : champ piège `website` (les robots le remplissent), au plus 3 demandes
/// par heure et par numéro, 10 par heure et par adresse IP, et validation complète côté serveur.
export async function submitBookingRequest(
  slug: string,
  input: BookingRequestInput,
  website: string
): Promise<BookingSubmitResult> {
  // Un robot a rempli le champ caché : on répond "ok" sans rien créer.
  if (website) return { ok: true };

  const establishment = await prisma.establishment.findFirst({
    where: { bookingSlug: slug, onlineBookingEnabled: true },
    include: { services: true },
  });
  if (!establishment) return { ok: false, error: "Ce lien de réservation n'est plus actif." };

  const now = new Date();
  const checked = validateBookingRequest(input, now, (date) => servicesOn(establishment.services, date));
  if (!checked.ok) return checked;
  const data = checked.data;

  // Le service a pu se remplir pendant que le client remplissait le formulaire.
  const dayDate = new Date(`${data.date}T00:00:00`);
  const capacity = await loadCapacity(establishment.id, dayDate);
  const stillOpen = buildAvailability({
    services: servicesOn(establishment.services, dayDate),
    ...capacity,
    partySize: data.partySize,
    isToday: startOfDay(dayDate).getTime() === startOfDay(now).getTime(),
    now,
  }).some((sv) => sv.times.includes(data.time));
  if (!stillOpen) {
    return { ok: false, error: "Ce créneau est complet. Choisis une autre heure, ou appelle le restaurant." };
  }

  const ip = await getClientIp();
  const phoneKey = normalizePhone(data.phone) ?? data.phone;
  if (!perPhone.allow(`${establishment.id}:${phoneKey}`, now.getTime()) || !perIp.allow(`${establishment.id}:${ip}`, now.getTime())) {
    return { ok: false, error: "Trop de demandes pour le moment. Merci de réessayer plus tard ou d'appeler le restaurant." };
  }

  const date = new Date(`${data.date}T00:00:00`);
  const duplicate = await prisma.reservation.findFirst({
    where: {
      establishmentId: establishment.id,
      customerPhone: data.phone,
      date,
      time: data.time,
      status: { in: ["new", "confirmed"] },
    },
  });
  if (duplicate) return { ok: false, error: "Une demande existe déjà pour ce numéro à cette heure." };

  await prisma.$transaction(async (tx) => {
    // Seuls les clients qui ont coché la case entrent dans la base clients (avec leur accord daté).
    const customerId =
      data.newsletterOptIn && data.email
        ? await subscribeCustomer(tx, establishment.id, {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            email: data.email,
          })
        : null;

    await tx.reservation.create({
      data: {
        establishmentId: establishment.id,
        customerId,
        customerName: `${data.firstName} ${data.lastName}`,
        customerPhone: data.phone,
        customerEmail: data.email,
        partySize: data.partySize,
        date,
        time: data.time,
        durationMinutes: 90,
        specialRequests: data.notes,
        source: "online",
        status: "new",
      },
    });
  });

  const managers = await prisma.membership.findMany({
    where: {
      establishmentId: establishment.id,
      status: "active",
      role: { permissions: { some: { permission: { key: "reservations.edit" } } } },
    },
    select: { id: true },
  });
  const when = format(date, "EEEE d MMMM", { locale: fr });
  await Promise.all(
    managers.map((m) =>
      notifyMember({
        establishmentId: establishment.id,
        membershipId: m.id,
        type: "reservation_request",
        severity: "important",
        title: "Nouvelle demande de réservation en ligne",
        body: `${data.firstName} ${data.lastName} · ${data.partySize} pers. · ${when} à ${data.time}`,
        linkHref: `/reservations?date=${data.date}`,
      })
    )
  );

  revalidatePath("/reservations");
  revalidatePath("/aujourdhui");
  return { ok: true };
}

function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "restaurant";
}

/// Active le lien public (le crée la première fois). Le suffixe aléatoire évite les collisions
/// et empêche de deviner le lien d'un autre restaurant.
export async function enableOnlineBooking() {
  const ctx = await requirePermission("settings.manage");
  let slug = ctx.establishment.bookingSlug;
  if (!slug) {
    for (let i = 0; i < 5 && !slug; i++) {
      const candidate = `${slugify(ctx.establishment.name)}-${randomBytes(3).toString("hex")}`;
      if (!(await prisma.establishment.findUnique({ where: { bookingSlug: candidate } }))) slug = candidate;
    }
    if (!slug) throw new Error("Impossible de créer le lien, réessaie.");
  }
  await prisma.establishment.update({ where: { id: ctx.establishment.id }, data: { bookingSlug: slug, onlineBookingEnabled: true } });
  revalidatePath("/parametres");
  return slug;
}

export async function disableOnlineBooking() {
  const ctx = await requirePermission("settings.manage");
  await prisma.establishment.update({ where: { id: ctx.establishment.id }, data: { onlineBookingEnabled: false } });
  revalidatePath("/parametres");
}
