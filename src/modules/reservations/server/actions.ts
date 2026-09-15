"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay, format } from "date-fns";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAnyPermission } from "@/lib/current-context";
import { findOrCreateCustomer } from "@/modules/customers/server/matching";

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
/// service (marquer arrivé/installé/terminé/no-show/annulé depuis le Mode Service ou
/// l'écran Réservations) — d'où les deux permissions acceptées. Jamais l'inverse :
/// configurer une table (déplacer, redimensionner) reste réservé à floorplan.edit.
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
  revalidatePath("/clients");
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
  revalidatePath("/clients");
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/// Vérifie que les tables choisies existent, appartiennent à l'établissement et ont la
/// capacité nécessaire (en tenant compte d'un groupe de tables combinées actif, ex:
/// T12+T13). Partagé par la création et la modification pour ne jamais dupliquer cette
/// règle de capacité.
async function assertTablesHaveCapacity(establishmentId: string, tableIds: string[], partySize: number) {
  const tables = await prisma.restaurantTable.findMany({
    where: { id: { in: tableIds }, establishmentId },
    include: { groupMemberships: { include: { group: true } } },
  });
  if (tables.length !== tableIds.length) {
    throw new Error("Une des tables sélectionnées est introuvable.");
  }

  const activeGroup = tables[0]?.groupMemberships.find((m) => {
    const g = m.group;
    const isActive = g.activeFrom <= new Date() && (!g.activeUntil || g.activeUntil >= new Date());
    return isActive && tables.every((t) => t.groupMemberships.some((gm) => gm.groupId === g.id));
  });
  const totalCapacity =
    activeGroup && tables.length > 1 ? activeGroup.group.combinedCapacity : tables.reduce((s, t) => s + t.capacity, 0);

  if (totalCapacity < partySize) {
    throw new Error(`La capacité sélectionnée (${totalCapacity}) est insuffisante pour ${partySize} personnes.`);
  }
}

/// Vérifie qu'aucune autre réservation active n'occupe déjà une des tables choisies sur
/// le créneau demandé. `excludeReservationId` permet à une modification de ne pas se
/// bloquer elle-même. Fait à l'intérieur de la transaction d'écriture pour qu'une
/// collision entre deux utilisateurs ne puisse jamais créer de double-booking.
async function assertNoTableConflict(
  tx: Prisma.TransactionClient,
  establishmentId: string,
  tableIds: string[],
  date: Date,
  time: string,
  durationMinutes: number,
  excludeReservationId?: string
) {
  const requestedStart = timeToMinutes(time);
  const requestedEnd = requestedStart + durationMinutes;

  const existing = await tx.reservationTable.findMany({
    where: {
      tableId: { in: tableIds },
      reservation: {
        id: excludeReservationId ? { not: excludeReservationId } : undefined,
        establishmentId,
        date: { gte: startOfDay(date), lte: endOfDay(date) },
        status: { notIn: ["cancelled", "no_show"] },
      },
    },
    include: { reservation: true, table: true },
  });

  const conflict = existing.find((rt) => {
    const start = timeToMinutes(rt.reservation.time);
    const end = start + rt.reservation.durationMinutes;
    return start < requestedEnd && end > requestedStart;
  });
  if (conflict) {
    throw new Error(
      `${conflict.table.label} vient d'être réservée (${conflict.reservation.customerName}, ${conflict.reservation.time}). Choisissez une autre table.`
    );
  }
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

/// Crée une réservation sur une ou plusieurs tables, et la relie à une fiche client
/// existante (par téléphone puis email) ou en crée une — voir findOrCreateCustomer.
/// Sans téléphone ni email, la réservation reste anonyme plutôt que de risquer un
/// mauvais rapprochement.
export async function createReservation(input: CreateReservationInput) {
  const ctx = await requirePermission("reservations.edit");
  const data = CreateReservationSchema.parse(input);

  await assertTablesHaveCapacity(ctx.establishment.id, data.tableIds, data.partySize);

  const date = new Date(`${data.date}T00:00:00`);

  const reservation = await prisma.$transaction(async (tx) => {
    await assertNoTableConflict(tx, ctx.establishment.id, data.tableIds, date, data.time, data.durationMinutes);

    const customerId = await findOrCreateCustomer(tx, ctx.establishment.id, {
      name: data.customerName,
      phone: data.customerPhone,
      email: data.customerEmail,
    });

    const created = await tx.reservation.create({
      data: {
        establishmentId: ctx.establishment.id,
        customerId,
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
  revalidatePath("/clients");

  return reservation;
}

const WalkInSchema = z.object({
  customerName: z.string().min(1, "Le nom du client est requis."),
  customerPhone: z.string().optional(),
  partySize: z.coerce.number().int().min(1).max(60),
  tableIds: z.array(z.string()).min(1, "Choisissez au moins une table."),
});

/// Un client se présente sans réservation et s'installe tout de suite : contrairement
/// à createReservation, on saute new/confirmed/arrived (jamais vécus) pour créer
/// directement en "seated", à l'heure et à la date du jour. Réutilise exactement les
/// mêmes vérifications de capacité et de conflit que createReservation.
export async function createWalkIn(input: z.infer<typeof WalkInSchema>) {
  const ctx = await requireAnyPermission("reservations.edit", "service.run");
  const data = WalkInSchema.parse(input);

  await assertTablesHaveCapacity(ctx.establishment.id, data.tableIds, data.partySize);

  const now = new Date();
  const date = startOfDay(now);
  const time = format(now, "HH:mm");

  const reservation = await prisma.$transaction(async (tx) => {
    await assertNoTableConflict(tx, ctx.establishment.id, data.tableIds, date, time, 90);

    const customerId = await findOrCreateCustomer(tx, ctx.establishment.id, {
      name: data.customerName,
      phone: data.customerPhone,
    });

    const created = await tx.reservation.create({
      data: {
        establishmentId: ctx.establishment.id,
        customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone || null,
        partySize: data.partySize,
        date,
        time,
        durationMinutes: 90,
        source: "walk_in",
        status: "seated",
      },
    });

    await tx.reservationTable.createMany({
      data: data.tableIds.map((tableId) => ({ reservationId: created.id, tableId })),
    });
    await tx.reservationStatusEvent.create({ data: { reservationId: created.id, status: "seated" } });

    return created;
  });

  revalidatePath("/reservations");
  revalidatePath("/plan-de-salle");
  revalidatePath("/aujourdhui");
  revalidatePath("/service");
  revalidatePath("/clients");

  return reservation;
}

const UpdateReservationSchema = z.object({
  partySize: z.coerce.number().int().min(1).max(60),
  date: z.string().min(1),
  time: z.string().min(1),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  notes: z.string().optional(),
  specialRequests: z.string().optional(),
});

/// Modifie une réservation existante (personnes, date, heure, durée, notes) sans
/// changer les tables déjà assignées — un vrai changement de table reste, pour l'instant,
/// une annulation + nouvelle réservation, la ré-assignation nécessitant la même UI de
/// sélection de tables que la création. La capacité et l'absence de conflit sont
/// revérifiées sur les tables actuelles avant d'enregistrer.
export async function updateReservationDetails(reservationId: string, input: z.infer<typeof UpdateReservationSchema>) {
  const ctx = await requirePermission("reservations.edit");
  const data = UpdateReservationSchema.parse(input);

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, establishmentId: ctx.establishment.id },
    include: { tables: true },
  });
  if (!reservation) throw new Error("Réservation introuvable.");
  if (["completed", "cancelled", "no_show"].includes(reservation.status)) {
    throw new Error("Cette réservation est déjà clôturée et ne peut plus être modifiée.");
  }

  const tableIds = reservation.tables.map((t) => t.tableId);
  await assertTablesHaveCapacity(ctx.establishment.id, tableIds, data.partySize);

  const date = new Date(`${data.date}T00:00:00`);

  await prisma.$transaction(async (tx) => {
    await assertNoTableConflict(tx, ctx.establishment.id, tableIds, date, data.time, data.durationMinutes, reservationId);

    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        partySize: data.partySize,
        date,
        time: data.time,
        durationMinutes: data.durationMinutes,
        notes: data.notes || null,
        specialRequests: data.specialRequests || null,
      },
    });
  });

  revalidatePath("/reservations");
  revalidatePath("/plan-de-salle");
  revalidatePath("/aujourdhui");
  revalidatePath("/service");
}
