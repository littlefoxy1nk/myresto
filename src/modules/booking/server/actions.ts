"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { isoWeekday } from "@/lib/time";
import { requirePermission } from "@/lib/current-context";
import { normalizePhone } from "@/modules/messaging/phone";
import { notifyMember } from "@/modules/myspace/server/notify";
import { createRateLimiter, validateBookingRequest, type BookingRequestInput } from "@/modules/booking/logic";

const HOUR = 3_600_000;
const perPhone = createRateLimiter(3, HOUR);
const perIp = createRateLimiter(10, HOUR);

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
  const checked = validateBookingRequest(input, now, (date) => {
    const weekday = isoWeekday(date);
    return establishment.services
      .filter((s) => s.daysOfWeek.split(",").map(Number).includes(weekday))
      .map((s) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime }));
  });
  if (!checked.ok) return checked;
  const data = checked.data;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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

  await prisma.reservation.create({
    data: {
      establishmentId: establishment.id,
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
