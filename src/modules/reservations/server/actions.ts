"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";

const VALID_STATUSES = [
  "new",
  "confirmed",
  "arrived",
  "seated",
  "completed",
  "cancelled",
  "no_show",
] as const;

export async function updateReservationStatus(reservationId: string, status: (typeof VALID_STATUSES)[number]) {
  const ctx = await requirePermission("reservations.edit");

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, establishmentId: ctx.establishment.id },
  });
  if (!reservation) throw new Error("Réservation introuvable");

  await prisma.reservation.update({ where: { id: reservationId }, data: { status } });
  await prisma.reservationStatusEvent.create({ data: { reservationId, status } });

  revalidatePath("/reservations");
  revalidatePath("/aujourdhui");
}
