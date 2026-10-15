"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/current-context";
import { CountdownSchema, type CountdownInput } from "@/modules/today/countdown";

const MAX_EVENTS = 20;

/// Ajoute un événement à décompter. Réservé à qui gère le planning ou les paramètres.
export async function createCountdownEvent(input: CountdownInput) {
  const ctx = await requireAnyPermission("settings.manage", "schedule.edit");
  const data = CountdownSchema.parse(input);
  if ((await prisma.countdownEvent.count({ where: { establishmentId: ctx.establishment.id } })) >= MAX_EVENTS) {
    throw new Error(`Maximum ${MAX_EVENTS} événements : supprime-en un avant d'en ajouter.`);
  }
  await prisma.countdownEvent.create({
    data: { establishmentId: ctx.establishment.id, title: data.title, date: new Date(`${data.date}T00:00:00`) },
  });
  revalidatePath("/aujourdhui");
}

export async function deleteCountdownEvent(id: string) {
  const ctx = await requireAnyPermission("settings.manage", "schedule.edit");
  const existing = await prisma.countdownEvent.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Événement introuvable.");
  await prisma.countdownEvent.delete({ where: { id } });
  revalidatePath("/aujourdhui");
}
