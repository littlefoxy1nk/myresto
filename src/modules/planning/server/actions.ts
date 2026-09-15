"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { addDays, differenceInCalendarDays, endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { SHIFT_POSITIONS } from "@/modules/planning/types";

const ShiftSchema = z.object({
  membershipId: z.string().min(1),
  serviceId: z.string().min(1).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  position: z.enum(SHIFT_POSITIONS),
});

type ShiftInput = z.infer<typeof ShiftSchema>;

function revalidatePlanningPaths() {
  // Le planning influe sur les heures affichées dans /equipe et sur le staffing du
  // jour dans /aujourdhui — les trois doivent rester synchronisés après toute mutation.
  revalidatePath("/planning");
  revalidatePath("/equipe");
  revalidatePath("/aujourdhui");
}

async function assertOwnership(establishmentId: string, data: ShiftInput) {
  const membership = await prisma.membership.findFirst({ where: { id: data.membershipId, establishmentId } });
  if (!membership) throw new Error("Membre introuvable.");

  if (data.serviceId) {
    const service = await prisma.serviceDefinition.findFirst({ where: { id: data.serviceId, establishmentId } });
    if (!service) throw new Error("Service introuvable.");
  }

  if (data.endTime <= data.startTime) {
    throw new Error("L'heure de fin doit être après l'heure de début.");
  }
}

export async function createShift(input: ShiftInput) {
  const ctx = await requirePermission("schedule.edit");
  const data = ShiftSchema.parse(input);
  await assertOwnership(ctx.establishment.id, data);

  const shift = await prisma.shift.create({
    data: {
      establishmentId: ctx.establishment.id,
      membershipId: data.membershipId,
      serviceId: data.serviceId,
      date: new Date(`${data.date}T00:00:00`),
      startTime: data.startTime,
      endTime: data.endTime,
      position: data.position,
      status: "published",
    },
  });

  revalidatePlanningPaths();
  return shift;
}

export async function updateShift(id: string, input: ShiftInput) {
  const ctx = await requirePermission("schedule.edit");
  const data = ShiftSchema.parse(input);
  await assertOwnership(ctx.establishment.id, data);

  const existing = await prisma.shift.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Shift introuvable.");

  const shift = await prisma.shift.update({
    where: { id },
    data: {
      membershipId: data.membershipId,
      serviceId: data.serviceId,
      date: new Date(`${data.date}T00:00:00`),
      startTime: data.startTime,
      endTime: data.endTime,
      position: data.position,
    },
  });

  revalidatePlanningPaths();
  return shift;
}

export async function deleteShift(id: string) {
  const ctx = await requirePermission("schedule.edit");
  const existing = await prisma.shift.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Shift introuvable.");

  await prisma.shift.delete({ where: { id } });
  revalidatePlanningPaths();
}

/// Copie tous les shifts d'une semaine vers une autre, jour de semaine par jour de
/// semaine (lundi de la source -> lundi de la cible, etc.). N'écrase jamais les shifts
/// déjà présents sur la semaine cible — s'ils se chevauchent avec la copie, le badge de
/// conflit existant (evaluateShift) le signalera normalement, sans bloquer la copie.
export async function duplicateWeek(sourceWeekStart: string, targetWeekStart: string) {
  const ctx = await requirePermission("schedule.edit");

  const source = new Date(`${sourceWeekStart}T00:00:00`);
  const target = new Date(`${targetWeekStart}T00:00:00`);
  const sourceEnd = addDays(source, 6);

  const shifts = await prisma.shift.findMany({
    where: {
      establishmentId: ctx.establishment.id,
      date: { gte: startOfDay(source), lte: endOfDay(sourceEnd) },
      status: { not: "cancelled" },
    },
  });
  if (shifts.length === 0) throw new Error("Aucun shift à dupliquer sur cette semaine.");

  await prisma.shift.createMany({
    data: shifts.map((s) => ({
      establishmentId: ctx.establishment.id,
      membershipId: s.membershipId,
      serviceId: s.serviceId,
      date: addDays(target, differenceInCalendarDays(startOfDay(s.date), source)),
      startTime: s.startTime,
      endTime: s.endTime,
      position: s.position,
      status: "published",
    })),
  });

  revalidatePlanningPaths();
  return shifts.length;
}
