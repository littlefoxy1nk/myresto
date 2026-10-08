"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAnyPermission } from "@/lib/current-context";
import { startOfDay, endOfDay } from "date-fns";
import { ZONE_TYPES, TABLE_SHAPES, TABLE_MANUAL_STATUSES } from "@/modules/floorplan/types";
import { nextGridPosition } from "@/modules/floorplan/compute";

const PATH = "/plan-de-salle";

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

const ZoneCreateSchema = z.object({
  name: z.string().min(1, "Le nom est requis."),
  type: z.enum(ZONE_TYPES),
});

export async function createZone(input: z.infer<typeof ZoneCreateSchema>) {
  const ctx = await requirePermission("floorplan.edit");
  const data = ZoneCreateSchema.parse(input);

  const count = await prisma.zone.count({ where: { establishmentId: ctx.establishment.id } });
  const zone = await prisma.zone.create({
    data: { establishmentId: ctx.establishment.id, name: data.name, type: data.type, sortOrder: count },
  });
  revalidatePath(PATH);
  return zone;
}

const ZoneUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  type: z.enum(ZONE_TYPES).optional(),
});

export async function updateZone(input: z.infer<typeof ZoneUpdateSchema>) {
  const ctx = await requirePermission("floorplan.edit");
  const data = ZoneUpdateSchema.parse(input);

  const zone = await prisma.zone.findFirst({ where: { id: data.id, establishmentId: ctx.establishment.id } });
  if (!zone) throw new Error("Zone introuvable.");

  await prisma.zone.update({ where: { id: data.id }, data: { name: data.name, type: data.type } });
  revalidatePath(PATH);
}

export async function deleteZone(zoneId: string) {
  const ctx = await requirePermission("floorplan.edit");

  const zone = await prisma.zone.findFirst({
    where: { id: zoneId, establishmentId: ctx.establishment.id },
    include: { tables: { select: { id: true, label: true, groupMemberships: { select: { groupId: true } } } } },
  });
  if (!zone) throw new Error("Zone introuvable.");

  // Les tables partent avec la zone, mais jamais au détriment d'un service en cours :
  // même garde-fou que deleteTable, appliqué à toutes les tables de la zone.
  const tableIds = zone.tables.map((t) => t.id);
  if (tableIds.length > 0) {
    const today = new Date();
    const busy = await prisma.reservationTable.findMany({
      where: {
        tableId: { in: tableIds },
        reservation: {
          date: { gte: startOfDay(today), lte: endOfDay(today) },
          status: { notIn: ["cancelled", "completed", "no_show"] },
        },
      },
      select: { tableId: true },
    });
    if (busy.length > 0) {
      const busyLabels = zone.tables.filter((t) => busy.some((b) => b.tableId === t.id)).map((t) => t.label);
      throw new Error(
        `Impossible : ${busyLabels.join(", ")} ${busyLabels.length > 1 ? "ont" : "a"} une réservation active aujourd'hui — annulez-la d'abord.`
      );
    }
  }

  const groupIds = [...new Set(zone.tables.flatMap((t) => t.groupMemberships.map((m) => m.groupId)))];
  await prisma.zone.delete({ where: { id: zoneId } });
  await cleanupUndersizedGroups(groupIds);
  revalidatePath(PATH);
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const TableCreateSchema = z.object({
  zoneId: z.string(),
  label: z.string().min(1, "Le nom de la table est requis."),
  capacity: z.coerce.number().int().min(1).max(30),
  shape: z.enum(TABLE_SHAPES),
});

/// La position de départ n'est plus jamais choisie par l'appelant : avant, toute
/// nouvelle table atterrissait au même point (40,40) et s'empilait sur les précédentes,
/// obligeant à la faire glisser à la main juste pour la voir. Elle prend maintenant la
/// prochaine case libre de la grille (voir nextGridPosition, compute.ts) — toujours
/// modifiable ensuite au glisser-déposer, ça reste juste un point de départ sensé.
export async function createTable(input: z.input<typeof TableCreateSchema>) {
  const ctx = await requirePermission("floorplan.edit");
  const data = TableCreateSchema.parse(input);

  const zone = await prisma.zone.findFirst({ where: { id: data.zoneId, establishmentId: ctx.establishment.id } });
  if (!zone) throw new Error("Zone introuvable.");

  const existingCount = await prisma.restaurantTable.count({ where: { zoneId: data.zoneId } });
  const { posX, posY } = nextGridPosition(existingCount);

  const table = await prisma.restaurantTable.create({
    data: {
      establishmentId: ctx.establishment.id,
      zoneId: data.zoneId,
      label: data.label,
      capacity: data.capacity,
      shape: data.shape,
      posX,
      posY,
    },
  });
  revalidatePath(PATH);
  return table;
}

const TablesBulkCreateSchema = z.object({
  zoneId: z.string(),
  count: z.coerce.number().int().min(1).max(50),
  labelPrefix: z.string().min(1, "Le préfixe est requis."),
  capacity: z.coerce.number().int().min(1).max(30),
  shape: z.enum(TABLE_SHAPES),
});

/// Création rapide de plusieurs tables identiques d'un coup ("8 tables de 4") plutôt que
/// de rouvrir la fenêtre une fois par table — le cas le plus courant à l'ouverture d'une
/// nouvelle zone. Chaque table reçoit sa propre case de grille (voir nextGridPosition),
/// numérotée à la suite des tables déjà présentes dans la zone ; libre ensuite de
/// renommer ou déplacer individuellement, exactement comme une table créée une par une.
export async function createTablesBulk(input: z.input<typeof TablesBulkCreateSchema>) {
  const ctx = await requirePermission("floorplan.edit");
  const data = TablesBulkCreateSchema.parse(input);

  const zone = await prisma.zone.findFirst({ where: { id: data.zoneId, establishmentId: ctx.establishment.id } });
  if (!zone) throw new Error("Zone introuvable.");

  const existingCount = await prisma.restaurantTable.count({ where: { zoneId: data.zoneId } });

  await prisma.restaurantTable.createMany({
    data: Array.from({ length: data.count }, (_, i) => {
      const { posX, posY } = nextGridPosition(existingCount + i);
      return {
        establishmentId: ctx.establishment.id,
        zoneId: data.zoneId,
        label: `${data.labelPrefix}${existingCount + i + 1}`,
        capacity: data.capacity,
        shape: data.shape,
        posX,
        posY,
      };
    }),
  });

  revalidatePath(PATH);
  return data.count;
}

const TablePatchSchema = z.object({
  id: z.string(),
  zoneId: z.string().optional(),
  label: z.string().min(1).optional(),
  capacity: z.coerce.number().int().min(1).max(30).optional(),
  shape: z.enum(TABLE_SHAPES).optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  width: z.number().min(40).max(400).optional(),
  height: z.number().min(40).max(400).optional(),
  status: z.enum(TABLE_MANUAL_STATUSES).optional(),
});

export async function updateTable(input: z.infer<typeof TablePatchSchema>) {
  const ctx = await requirePermission("floorplan.edit");
  const { id, ...patch } = TablePatchSchema.parse(input);

  const table = await prisma.restaurantTable.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!table) throw new Error("Table introuvable.");

  if (patch.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: patch.zoneId, establishmentId: ctx.establishment.id } });
    if (!zone) throw new Error("Zone de destination introuvable.");
  }

  await prisma.restaurantTable.update({ where: { id }, data: patch });
  revalidatePath(PATH);
}

/// Version étroite d'updateTable : ne touche que le statut manuel (disponible / nettoyage /
/// indisponible). Séparée de updateTable pour que le personnel de salle (service.run) puisse
/// faire cette action opérationnelle pendant le service sans hériter du droit de reconfigurer
/// une table (nom, capacité, position, forme) — qui reste réservé à floorplan.edit.
export async function setTableManualStatus(tableId: string, status: (typeof TABLE_MANUAL_STATUSES)[number]) {
  const ctx = await requireAnyPermission("floorplan.edit", "service.run");

  const table = await prisma.restaurantTable.findFirst({ where: { id: tableId, establishmentId: ctx.establishment.id } });
  if (!table) throw new Error("Table introuvable.");

  await prisma.restaurantTable.update({ where: { id: tableId }, data: { status } });
  revalidatePath(PATH);
  revalidatePath("/service");
}

export async function deleteTable(tableId: string) {
  const ctx = await requirePermission("floorplan.edit");

  const table = await prisma.restaurantTable.findFirst({
    where: { id: tableId, establishmentId: ctx.establishment.id },
    include: { groupMemberships: true },
  });
  if (!table) throw new Error("Table introuvable.");

  const today = new Date();
  const activeReservationCount = await prisma.reservationTable.count({
    where: {
      tableId,
      reservation: {
        date: { gte: startOfDay(today), lte: endOfDay(today) },
        status: { notIn: ["cancelled", "completed", "no_show"] },
      },
    },
  });
  if (activeReservationCount > 0) {
    throw new Error("Cette table a une réservation active aujourd'hui — annulez-la d'abord.");
  }

  const groupIds = table.groupMemberships.map((m) => m.groupId);
  await prisma.restaurantTable.delete({ where: { id: tableId } });
  await cleanupUndersizedGroups(groupIds);

  revalidatePath(PATH);
}

export async function duplicateTable(tableId: string) {
  const ctx = await requirePermission("floorplan.edit");

  const original = await prisma.restaurantTable.findFirst({
    where: { id: tableId, establishmentId: ctx.establishment.id },
  });
  if (!original) throw new Error("Table introuvable.");

  let label = `${original.label} (copie)`;
  let suffix = 2;
  while (await prisma.restaurantTable.findFirst({ where: { establishmentId: ctx.establishment.id, label } })) {
    label = `${original.label} (copie ${suffix})`;
    suffix += 1;
  }

  const table = await prisma.restaurantTable.create({
    data: {
      establishmentId: ctx.establishment.id,
      zoneId: original.zoneId,
      label,
      capacity: original.capacity,
      shape: original.shape,
      posX: original.posX + 30,
      posY: original.posY + 30,
      width: original.width,
      height: original.height,
    },
  });
  revalidatePath(PATH);
  return table;
}

// ---------------------------------------------------------------------------
// Groupes de tables (fusion)
// ---------------------------------------------------------------------------

const GroupCreateSchema = z.object({
  tableIds: z.array(z.string()).min(2, "Sélectionnez au moins deux tables."),
  combinedCapacity: z.coerce.number().int().min(1).max(60),
  label: z.string().optional(),
});

export async function createTableGroup(input: z.infer<typeof GroupCreateSchema>) {
  const ctx = await requirePermission("floorplan.edit");
  const data = GroupCreateSchema.parse(input);

  const tables = await prisma.restaurantTable.findMany({
    where: { id: { in: data.tableIds }, establishmentId: ctx.establishment.id },
    include: { groupMemberships: true },
  });
  if (tables.length !== data.tableIds.length) throw new Error("Une des tables sélectionnées est introuvable.");

  const zoneIds = new Set(tables.map((t) => t.zoneId));
  if (zoneIds.size > 1) throw new Error("Seules des tables d'une même zone peuvent être fusionnées.");

  const now = new Date();
  const alreadyGrouped = await prisma.tableGroupMember.findFirst({
    where: {
      tableId: { in: data.tableIds },
      group: { activeFrom: { lte: now }, OR: [{ activeUntil: null }, { activeUntil: { gte: now } }] },
    },
  });
  if (alreadyGrouped) throw new Error("Une de ces tables fait déjà partie d'un groupe actif.");

  const group = await prisma.tableGroup.create({
    data: {
      establishmentId: ctx.establishment.id,
      label: data.label || null,
      combinedCapacity: data.combinedCapacity,
      isPermanent: true,
    },
  });
  await prisma.tableGroupMember.createMany({
    data: data.tableIds.map((tableId) => ({ groupId: group.id, tableId })),
  });

  revalidatePath(PATH);
  return group;
}

export async function dissolveTableGroup(groupId: string) {
  const ctx = await requirePermission("floorplan.edit");

  const group = await prisma.tableGroup.findFirst({
    where: { id: groupId, establishmentId: ctx.establishment.id },
  });
  if (!group) throw new Error("Groupe introuvable.");

  await prisma.tableGroup.update({ where: { id: groupId }, data: { activeUntil: new Date() } });
  revalidatePath(PATH);
}

/// Un groupe réduit à 0 ou 1 table (après suppression d'une table membre) n'a plus de
/// sens métier — on le clôture pour ne pas laisser un "groupe" fantôme sur le plan.
async function cleanupUndersizedGroups(groupIds: string[]) {
  for (const groupId of groupIds) {
    const remaining = await prisma.tableGroupMember.count({ where: { groupId } });
    if (remaining < 2) {
      await prisma.tableGroup.update({ where: { id: groupId }, data: { activeUntil: new Date() } });
    }
  }
}
