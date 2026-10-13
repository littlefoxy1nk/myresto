"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";

const STATES = ["none", "asked", "confirmed"] as const;

function revalidate() {
  revalidatePath("/reservations");
  revalidatePath("/aujourdhui");
}

/// Pose le suivi de confirmation d'une réservation : "confirmed" = V (le client a confirmé),
/// "asked" = ? (message envoyé, pas de nouvelle), "none" = rien. Indépendant du statut de la
/// réservation (nouvelle / confirmée / installée…).
export async function setConfirmationState(reservationId: string, state: (typeof STATES)[number]) {
  const ctx = await requirePermission("reservations.edit");
  const parsed = z.enum(STATES).parse(state);

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, establishmentId: ctx.establishment.id },
  });
  if (!reservation) throw new Error("Réservation introuvable.");

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      confirmationState: parsed,
      confirmationAskedAt: parsed === "asked" ? new Date() : parsed === "none" ? null : reservation.confirmationAskedAt,
    },
  });
  revalidate();
}

/// Appelé quand le responsable ouvre le message de demande de confirmation d'un client :
/// la réservation passe à "?" (en attente de réponse) — sauf si le client a déjà confirmé.
export async function markConfirmationAsked(reservationId: string) {
  const ctx = await requirePermission("reservations.edit");

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, establishmentId: ctx.establishment.id },
  });
  if (!reservation) throw new Error("Réservation introuvable.");
  if (reservation.confirmationState === "confirmed") return;

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { confirmationState: "asked", confirmationAskedAt: new Date() },
  });
  revalidate();
}
