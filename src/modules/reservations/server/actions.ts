"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAnyPermission } from "@/lib/current-context";

const VALID_STATUSES = [
  "new",
  "confirmed",
  "arrived",
  "seated",
  "completed",
  "cancelled",
  "no_show",
] as const;

/// Changer le statut d'une réservation est à la fois une action de configuration
/// (confirmer depuis l'écran Réservations) et une action opérationnelle pendant le
/// service (marquer arrivé/installé/terminé depuis le Mode Service) — d'où les deux
/// permissions acceptées. Jamais l'inverse : configurer une table (déplacer, redimensionner)
/// reste réservé à floorplan.edit, jamais accessible via service.run.
export async function updateReservationStatus(reservationId: string, status: (typeof VALID_STATUSES)[number]) {
  const ctx = await requireAnyPermission("reservations.edit", "service.run");

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, establishmentId: ctx.establishment.id },
  });
  if (!reservation) throw new Error("Réservation introuvable");

  await prisma.reservation.update({ where: { id: reservationId }, data: { status } });
  await prisma.reservationStatusEvent.create({ data: { reservationId, status } });

  revalidatePath("/reservations");
  revalidatePath("/aujourdhui");
  revalidatePath("/plan-de-salle");
  revalidatePath("/service");
}

/// "Libérer" une table (Mode Service) : le client est parti. Marquer la réservation
/// "completed" suffit déjà à ce que computeTableLiveState arrête de la compter comme
/// occupante — mais dans la réalité d'un service, une table qui se vide a besoin d'être
/// nettoyée avant d'accueillir quelqu'un d'autre. On l'affecte donc explicitement en
/// nettoyage plutôt que de la remettre "disponible" en un clic ; "Marquer prête"
/// (setTableManualStatus) reste l'étape suivante, déclenchée par le staff une fois fait.
export async function releaseReservationTables(reservationId: string) {
  const ctx = await requireAnyPermission("reservations.edit", "service.run");

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, establishmentId: ctx.establishment.id },
    include: { tables: true },
  });
  if (!reservation) throw new Error("Réservation introuvable");

  await prisma.reservation.update({ where: { id: reservationId }, data: { status: "completed" } });
  await prisma.reservationStatusEvent.create({ data: { reservationId, status: "completed" } });
  await prisma.restaurantTable.updateMany({
    where: { id: { in: reservation.tables.map((t) => t.tableId) } },
    data: { status: "cleaning" },
  });

  revalidatePath("/reservations");
  revalidatePath("/aujourdhui");
  revalidatePath("/plan-de-salle");
  revalidatePath("/service");
}

const CreateReservationSchema = z.object({
  customerName: z.string().min(1, "Le nom du client est requis."),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email("Email invalide.").optional().or(z.literal("")),
  partySize: z.coerce.number().int().min(1, "Au moins une personne.").max(60),
  date: z.string().min(1),
  time: z.string().min(1),
  durationMinutes: z.coerce.number().int().min(15).max(480).default(90),
  tableIds: z.array(z.string()).min(1, "Choisissez au moins une table."),
  notes: z.string().optional(),
  specialRequests: z.string().optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

/// Crée une réservation sur une ou plusieurs tables. La disponibilité affichée à l'écran
/// n'est qu'indicative — la vérification qui compte se fait ici, à l'intérieur de la
/// transaction, juste avant l'insertion, pour qu'une collision entre deux utilisateurs qui
/// réservent la même table au même moment ne puisse jamais créer un double-booking.
export async function createReservation(input: CreateReservationInput) {
  const ctx = await requirePermission("reservations.edit");
  const data = CreateReservationSchema.parse(input);

  const tables = await prisma.restaurantTable.findMany({
    where: { id: { in: data.tableIds }, establishmentId: ctx.establishment.id },
    include: { groupMemberships: { include: { group: true } } },
  });
  if (tables.length !== data.tableIds.length) {
    throw new Error("Une des tables sélectionnées est introuvable.");
  }

  const activeGroup = tables[0]?.groupMemberships.find((m) => {
    const g = m.group;
    const isActive = g.activeFrom <= new Date() && (!g.activeUntil || g.activeUntil >= new Date());
    return isActive && tables.every((t) => t.groupMemberships.some((gm) => gm.groupId === g.id));
  });
  const totalCapacity =
    activeGroup && tables.length > 1 ? activeGroup.group.combinedCapacity : tables.reduce((s, t) => s + t.capacity, 0);

  if (totalCapacity < data.partySize) {
    throw new Error(
      `La capacité sélectionnée (${totalCapacity}) est insuffisante pour ${data.partySize} personnes.`
    );
  }

  const date = new Date(`${data.date}T00:00:00`);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const [rh, rm] = data.time.split(":").map(Number);
  const requestedStart = rh * 60 + rm;
  const requestedEnd = requestedStart + data.durationMinutes;

  const reservation = await prisma.$transaction(async (tx) => {
    const existing = await tx.reservationTable.findMany({
      where: {
        tableId: { in: data.tableIds },
        reservation: {
          establishmentId: ctx.establishment.id,
          date: { gte: dayStart, lte: dayEnd },
          status: { notIn: ["cancelled", "no_show"] },
        },
      },
      include: { reservation: true, table: true },
    });

    const conflict = existing.find((rt) => {
      const [h, m] = rt.reservation.time.split(":").map(Number);
      const start = h * 60 + m;
      const end = start + rt.reservation.durationMinutes;
      return start < requestedEnd && end > requestedStart;
    });
    if (conflict) {
      throw new Error(
        `${conflict.table.label} vient d'être réservée (${conflict.reservation.customerName}, ${conflict.reservation.time}). Choisissez une autre table.`
      );
    }

    const created = await tx.reservation.create({
      data: {
        establishmentId: ctx.establishment.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone || null,
        customerEmail: data.customerEmail || null,
        partySize: data.partySize,
        date,
        time: data.time,
        durationMinutes: data.durationMinutes,
        notes: data.notes || null,
        specialRequests: data.specialRequests || null,
        source: "manual",
        status: "new",
      },
    });

    await tx.reservationTable.createMany({
      data: data.tableIds.map((tableId) => ({ reservationId: created.id, tableId })),
    });
    await tx.reservationStatusEvent.create({ data: { reservationId: created.id, status: "new" } });

    return created;
  });

  revalidatePath("/reservations");
  revalidatePath("/plan-de-salle");
  revalidatePath("/aujourdhui");

  return reservation;
}
