"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay, format } from "date-fns";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { timeToMinutes } from "@/lib/time";
import { requirePermission, requireAnyPermission } from "@/lib/current-context";
import { findOrCreateCustomer } from "@/modules/customers/server/matching";
import { fetchZonesAndGroups } from "@/modules/floorplan/server/queries";
import { groupInstantFor } from "@/modules/floorplan/group-scope";
import { isMovable, type DayBooking } from "@/modules/reservations/move";
import { effectiveDuration } from "@/modules/service/spans";
import { getServiceWindowsForDate } from "@/modules/service/server/windows";

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
/// nettoyée — mais "libérée" dit déjà "prête" : la table redevient directement disponible.
/// Le statut manuel "Nettoyage" reste un choix explicite du staff (panneau de la table).
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
    where: { id: { in: reservation.tables.map((t) => t.tableId) }, status: "cleaning" },
    data: { status: "available" },
  });

  revalidatePath("/reservations");
  revalidatePath("/aujourdhui");
  revalidatePath("/plan-de-salle");
  revalidatePath("/service");
  revalidatePath("/clients");
}

/// Vérifie que les tables choisies existent, appartiennent à l'établissement et ont la
/// capacité nécessaire (en tenant compte d'un groupe de tables combinées actif, ex:
/// T12+T13). Partagé par la création et la modification pour ne jamais dupliquer cette
/// règle de capacité.
async function assertTablesHaveCapacity(
  establishmentId: string,
  tableIds: string[],
  partySize: number,
  allowOverCapacity = false,
  at: Date = new Date()
) {
  const tables = await prisma.restaurantTable.findMany({
    where: { id: { in: tableIds }, establishmentId },
    include: { groupMemberships: { include: { group: true } } },
  });
  if (tables.length !== tableIds.length) {
    throw new Error("Une des tables sélectionnées est introuvable.");
  }

  const activeGroup = tables[0]?.groupMemberships.find((m) => {
    const g = m.group;
    const isActive = g.activeFrom <= at && (!g.activeUntil || g.activeUntil >= at);
    return isActive && tables.every((t) => t.groupMemberships.some((gm) => gm.groupId === g.id));
  });
  const totalCapacity =
    activeGroup && tables.length > 1 ? activeGroup.group.combinedCapacity : tables.reduce((s, t) => s + t.capacity, 0);

  if (totalCapacity < partySize && !allowOverCapacity) {
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
  /// Posé par l'écran seulement après avoir signalé "capacité dépassée" et reçu un OK explicite.
  allowOverCapacity: z.boolean().optional(),
  /// Bloque aussi le service suivant : la durée est étendue jusqu'à sa fin (voir service/spans.ts).
  spansNextService: z.boolean().optional(),
  blocksEvening: z.boolean().optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

/// Crée une réservation sur une ou plusieurs tables, et la relie à une fiche client
/// existante (par téléphone puis email) ou en crée une — voir findOrCreateCustomer.
/// Sans téléphone ni email, la réservation reste anonyme plutôt que de risquer un
/// mauvais rapprochement.
export async function createReservation(input: CreateReservationInput) {
  const ctx = await requirePermission("reservations.edit");
  const data = CreateReservationSchema.parse(input);

  const date = new Date(`${data.date}T00:00:00`);
  await assertTablesHaveCapacity(
    ctx.establishment.id,
    data.tableIds,
    data.partySize,
    data.allowOverCapacity,
    groupInstantFor(date, new Date())
  );

  const spans = data.spansNextService ?? false;
  const evening = data.blocksEvening ?? false;
  const durationMinutes = effectiveDuration(
    data.durationMinutes,
    data.time,
    spans,
    await getServiceWindowsForDate(ctx.establishment.id, date),
    evening
  );

  const reservation = await prisma.$transaction(async (tx) => {
    await assertNoTableConflict(tx, ctx.establishment.id, data.tableIds, date, data.time, durationMinutes);

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
        durationMinutes,
        spansNextService: spans,
        blocksEvening: evening,
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
  allowOverCapacity: z.boolean().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(480).default(90),
});

/// Un client se présente sans réservation et s'installe tout de suite : contrairement
/// à createReservation, on saute new/confirmed/arrived (jamais vécus) pour créer
/// directement en "seated", à l'heure et à la date du jour. Réutilise exactement les
/// mêmes vérifications de capacité et de conflit que createReservation.
export async function createWalkIn(input: z.infer<typeof WalkInSchema>) {
  const ctx = await requireAnyPermission("reservations.edit", "service.run");
  const data = WalkInSchema.parse(input);

  await assertTablesHaveCapacity(ctx.establishment.id, data.tableIds, data.partySize, data.allowOverCapacity);

  const now = new Date();
  const date = startOfDay(now);
  const time = format(now, "HH:mm");

  const reservation = await prisma.$transaction(async (tx) => {
    await assertNoTableConflict(tx, ctx.establishment.id, data.tableIds, date, time, data.durationMinutes);

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
        durationMinutes: data.durationMinutes,
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
  spansNextService: z.boolean().optional(),
  blocksEvening: z.boolean().optional(),
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
  const date = new Date(`${data.date}T00:00:00`);
  await assertTablesHaveCapacity(ctx.establishment.id, tableIds, data.partySize, false, groupInstantFor(date, new Date()));

  const spans = data.spansNextService ?? false;
  const evening = data.blocksEvening ?? false;
  const durationMinutes = effectiveDuration(
    data.durationMinutes,
    data.time,
    spans,
    await getServiceWindowsForDate(ctx.establishment.id, date),
    evening
  );

  await prisma.$transaction(async (tx) => {
    await assertNoTableConflict(tx, ctx.establishment.id, tableIds, date, data.time, durationMinutes, reservationId);

    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        partySize: data.partySize,
        date,
        time: data.time,
        durationMinutes,
        spansNextService: spans,
        blocksEvening: evening,
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

const DEFAULT_DURATION_MINUTES = 90;

/// Bloque (ou libère) la table d'une réservation pour toute la soirée : la durée est étendue jusqu'à
/// la fin du dernier service. Refusé si une autre réservation occupe déjà une de ses tables plus tard
/// ce soir-là — le message dit laquelle.
export async function setBlocksEvening(reservationId: string, blocks: boolean) {
  const ctx = await requirePermission("reservations.edit");

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, establishmentId: ctx.establishment.id },
    include: { tables: true },
  });
  if (!reservation) throw new Error("Réservation introuvable.");
  if (["completed", "cancelled", "no_show"].includes(reservation.status)) {
    throw new Error("Cette réservation est déjà clôturée.");
  }
  if (reservation.tables.length === 0) throw new Error("Attribue d'abord une table à cette réservation.");

  const services = await getServiceWindowsForDate(ctx.establishment.id, reservation.date);
  const durationMinutes = effectiveDuration(
    DEFAULT_DURATION_MINUTES,
    reservation.time,
    reservation.spansNextService,
    services,
    blocks
  );
  if (blocks && durationMinutes === DEFAULT_DURATION_MINUTES) {
    throw new Error("Rien à bloquer : cette réservation n'a pas de service après son heure.");
  }

  const tableIds = reservation.tables.map((t) => t.tableId);
  await prisma.$transaction(async (tx) => {
    await assertNoTableConflict(tx, ctx.establishment.id, tableIds, reservation.date, reservation.time, durationMinutes, reservationId);
    await tx.reservation.update({ where: { id: reservationId }, data: { blocksEvening: blocks, durationMinutes } });
  });

  revalidatePath("/reservations");
  revalidatePath("/plan-de-salle");
  revalidatePath("/aujourdhui");
  revalidatePath("/service");
}

export type MoveReservationData = {
  reservation: {
    id: string;
    customerName: string;
    partySize: number;
    date: string;
    time: string;
    durationMinutes: number;
    status: string;
    tableIds: string[];
  };
  zones: {
    id: string;
    name: string;
    tables: {
      id: string;
      label: string;
      capacity: number;
      manualStatus: string;
      group: { id: string; combinedCapacity: number } | null;
    }[];
  }[];
  /// Toutes les réservations actives de ce jour-là (avec leurs tables) : l'écran en déduit
  /// seul qui gêne qui — voir move.ts.
  bookings: DayBooking[];
};

/// Ce qu'il faut à l'écran "Changer de table" : la réservation, les tables, et les
/// réservations du même jour. Les données brutes suffisent — la logique de conflit est
/// pure et partagée (move.ts), pas dupliquée côté serveur.
export async function getMoveReservationData(reservationId: string): Promise<MoveReservationData> {
  const ctx = await requireAnyPermission("reservations.edit", "service.run");

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, establishmentId: ctx.establishment.id },
    include: { tables: true },
  });
  if (!reservation) throw new Error("Réservation introuvable.");

  const [{ zones, groupByTable }, dayReservations] = await Promise.all([
    fetchZonesAndGroups(ctx.establishment.id, groupInstantFor(reservation.date, new Date())),
    prisma.reservation.findMany({
      where: {
        establishmentId: ctx.establishment.id,
        date: { gte: startOfDay(reservation.date), lte: endOfDay(reservation.date) },
        status: { notIn: ["cancelled", "no_show"] },
      },
      include: { tables: true },
    }),
  ]);

  return {
    reservation: {
      id: reservation.id,
      customerName: reservation.customerName,
      partySize: reservation.partySize,
      date: format(reservation.date, "yyyy-MM-dd"),
      time: reservation.time,
      durationMinutes: reservation.durationMinutes,
      status: reservation.status,
      tableIds: reservation.tables.map((t) => t.tableId),
    },
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      tables: z.tables.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        manualStatus: t.status,
        group: groupByTable.get(t.id) ? { id: groupByTable.get(t.id)!.id, combinedCapacity: groupByTable.get(t.id)!.combinedCapacity } : null,
      })),
    })),
    bookings: dayReservations.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      partySize: r.partySize,
      time: r.time,
      durationMinutes: r.durationMinutes,
      status: r.status,
      tableIds: r.tables.map((t) => t.tableId),
    })),
  };
}

const MoveReservationSchema = z.object({
  moves: z
    .array(z.object({ reservationId: z.string(), tableIds: z.array(z.string()).min(1, "Choisissez au moins une table.") }))
    .min(1),
  allowOverCapacity: z.boolean().optional(),
});

/// Change la table d'une réservation, et au besoin celles des réservations qu'elle
/// déloge (échange 6 <-> 8, ou déplacement de l'occupante sur une autre table libre) —
/// le tout dans UNE transaction : soit tout le plan est valide, soit rien ne bouge.
/// Les conflits sont revérifiés après écriture de tous les déplacements, donc deux
/// réservations qui échangent leurs tables ne se bloquent pas l'une l'autre.
export async function moveReservation(input: z.infer<typeof MoveReservationSchema>) {
  const ctx = await requireAnyPermission("reservations.edit", "service.run");
  const data = MoveReservationSchema.parse(input);

  const ids = data.moves.map((m) => m.reservationId);
  if (new Set(ids).size !== ids.length) throw new Error("Une réservation est listée deux fois.");

  const reservations = await prisma.reservation.findMany({
    where: { id: { in: ids }, establishmentId: ctx.establishment.id },
  });
  if (reservations.length !== ids.length) throw new Error("Réservation introuvable.");
  for (const r of reservations) {
    if (!isMovable(r.status)) {
      throw new Error(`La réservation de ${r.customerName} est clôturée et ne peut plus changer de table.`);
    }
  }

  const allTableIds = [...new Set(data.moves.flatMap((m) => m.tableIds))];
  const tables = await prisma.restaurantTable.findMany({
    where: { id: { in: allTableIds }, establishmentId: ctx.establishment.id },
  });
  if (tables.length !== allTableIds.length) throw new Error("Une des tables sélectionnées est introuvable.");
  const blocked = tables.find((t) => t.status === "unavailable");
  if (blocked) throw new Error(`${blocked.label} est marquée indisponible.`);

  for (const m of data.moves) {
    const r = reservations.find((x) => x.id === m.reservationId)!;
    await assertTablesHaveCapacity(
      ctx.establishment.id,
      m.tableIds,
      r.partySize,
      data.allowOverCapacity,
      groupInstantFor(r.date, new Date())
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const m of data.moves) {
      await tx.reservationTable.deleteMany({ where: { reservationId: m.reservationId } });
      await tx.reservationTable.createMany({
        data: [...new Set(m.tableIds)].map((tableId) => ({ reservationId: m.reservationId, tableId })),
      });
    }
    for (const m of data.moves) {
      const r = reservations.find((x) => x.id === m.reservationId)!;
      await assertNoTableConflict(tx, ctx.establishment.id, m.tableIds, r.date, r.time, r.durationMinutes, r.id);
    }
  });

  revalidatePath("/reservations");
  revalidatePath("/plan-de-salle");
  revalidatePath("/aujourdhui");
  revalidatePath("/service");
}
