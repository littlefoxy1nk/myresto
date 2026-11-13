import { after } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/app-url";
import { isNotificationMuted } from "@/lib/notification-preferences";
import { buildBookingAlertEmail, buildGuestConfirmationEmail } from "@/modules/messaging/emails";
import { sendMail } from "@/modules/settings/mailer";
import { readSmtpConfig } from "@/modules/settings/contact";

/// Lance l'envoi APRÈS avoir répondu à la personne (elle n'attend pas le serveur d'email). Hors d'une requête (scripts, tests),
/// on attend simplement la fin. Une erreur d'envoi est notée dans les journaux, jamais remontée : elle ne doit pas empêcher
/// la réservation d'être enregistrée ou confirmée.
function inBackground(label: string, work: () => Promise<void>): Promise<void> | void {
  const run = () =>
    work().catch((error) => {
      console.error(`Email « ${label} » non envoyé`, error);
    });
  try {
    after(run);
  } catch {
    return run();
  }
}

/// Une demande vient d'arriver par le lien en ligne : un email à chaque personne qui gère les réservations (et qui a une
/// adresse email), sauf celles qui ont coupé ces notifications dans leurs réglages.
export function emailBookingAlert(reservationId: string): Promise<void> | void {
  const smtp = readSmtpConfig(process.env);
  if (!smtp) return;
  return inBackground("alerte réservation", async () => {
    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { establishment: true } });
    if (!reservation || reservation.establishment.isDemo) return;
    const managers = await prisma.membership.findMany({
      where: {
        establishmentId: reservation.establishmentId,
        status: "active",
        user: { email: { not: null } },
        role: { key: { not: "SUPPORT" }, permissions: { some: { permission: { key: "reservations.edit" } } } },
      },
      select: { mutedNotificationCategories: true, user: { select: { email: true } } },
    });
    const base = appBaseUrl();
    const link = base ? `${base}/reservations?date=${format(reservation.date, "yyyy-MM-dd")}` : null;
    const mail = buildBookingAlertEmail(reservation, reservation.establishment, link);
    for (const manager of managers) {
      if (!manager.user.email || isNotificationMuted(manager.mutedNotificationCategories, "reservation_request")) continue;
      await sendMail(smtp, { ...mail, to: manager.user.email, fromName: reservation.establishment.name });
    }
  });
}

/// « sent » = l'email part ; sinon la raison pour laquelle rien n'est parti, pour que l'écran puisse la dire.
export type GuestEmailOutcome = "sent" | "no-email" | "already-sent" | "disabled" | "not-configured";

/// La réservation vient d'être confirmée : un email au client (une seule fois), s'il a laissé son adresse, si l'établissement
/// n'a pas coupé cette option et si l'envoi est configuré. Retourne « sent » quand l'envoi est lancé, sinon la raison.
export async function emailGuestConfirmation(reservationId: string, establishmentId: string): Promise<GuestEmailOutcome> {
  const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, establishmentId }, include: { establishment: true } });
  if (!reservation?.customerEmail) return "no-email";
  if (reservation.confirmationEmailSentAt) return "already-sent";
  if (!reservation.establishment.emailConfirmations || reservation.establishment.isDemo) return "disabled";
  const smtp = readSmtpConfig(process.env);
  if (!smtp) return "not-configured";

  // On réserve l'envoi avant de partir : deux clics rapprochés ne produisent pas deux emails. Si l'envoi échoue, on libère.
  const claimed = await prisma.reservation.updateMany({ where: { id: reservationId, confirmationEmailSentAt: null }, data: { confirmationEmailSentAt: new Date() } });
  if (claimed.count === 0) return "already-sent";

  const owner = await prisma.membership.findFirst({
    where: { establishmentId, status: "active", role: { key: "OWNER" }, user: { email: { not: null } } },
    select: { user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const mail = buildGuestConfirmationEmail(reservation, reservation.establishment);
  const to = reservation.customerEmail;
  const pending = inBackground("confirmation client", async () => {
    try {
      await sendMail(smtp, { ...mail, to, replyTo: owner?.user.email ?? undefined, fromName: reservation.establishment.name });
    } catch (error) {
      await prisma.reservation.updateMany({ where: { id: reservationId }, data: { confirmationEmailSentAt: null } });
      throw error;
    }
  });
  if (pending) await pending;
  return "sent";
}
