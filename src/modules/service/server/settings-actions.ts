"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { serviceLabel } from "@/lib/service-label";
import { validateService, type ServiceInput } from "@/modules/service/validation";

const ServiceSchema = z.object({
  name: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  days: z.array(z.number()),
});

async function otherServices(establishmentId: string) {
  const all = await prisma.serviceDefinition.findMany({ where: { establishmentId } });
  return all.map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    days: s.daysOfWeek.split(",").map(Number),
  }));
}

function revalidate() {
  for (const path of ["/parametres", "/planning", "/reservations", "/plan-de-salle", "/service", "/aujourdhui"]) {
    revalidatePath(path);
  }
}

function toData(input: ServiceInput) {
  return {
    // Jamais de nom générique : le service s'appelle par son horaire ("Service de 18h à 20h30").
    name: serviceLabel(input.startTime, input.endTime),
    startTime: input.startTime,
    endTime: input.endTime,
    daysOfWeek: [...new Set(input.days)].sort().join(","),
  };
}

export async function createService(input: z.infer<typeof ServiceSchema>) {
  const ctx = await requirePermission("settings.manage");
  const data = ServiceSchema.parse(input);
  const error = validateService(data, await otherServices(ctx.establishment.id));
  if (error) throw new Error(error);

  await prisma.serviceDefinition.create({ data: { establishmentId: ctx.establishment.id, ...toData(data) } });
  revalidate();
}

export async function updateService(id: string, input: z.infer<typeof ServiceSchema>) {
  const ctx = await requirePermission("settings.manage");
  const data = ServiceSchema.parse(input);

  const existing = await prisma.serviceDefinition.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Service introuvable.");
  const error = validateService(data, await otherServices(ctx.establishment.id), id);
  if (error) throw new Error(error);

  await prisma.serviceDefinition.update({ where: { id }, data: toData(data) });
  revalidate();
}

/// Un service déjà utilisé (horaires de l'équipe, besoins, réservations…) ne se supprime pas :
/// ce serait effacer de l'historique en silence. Il faut d'abord le vider, ou le modifier.
export async function deleteService(id: string) {
  const ctx = await requirePermission("settings.manage");

  const service = await prisma.serviceDefinition.findFirst({
    where: { id, establishmentId: ctx.establishment.id },
    include: {
      _count: {
        select: { shifts: true, reservations: true, availabilities: true, staffingRequirements: true, coverageRequests: true },
      },
    },
  });
  if (!service) throw new Error("Service introuvable.");

  const total = Object.values(service._count).reduce((a, b) => a + b, 0);
  if (total > 0) {
    throw new Error(
      "Ce service est déjà utilisé (horaires, disponibilités, besoins ou réservations). Modifie-le plutôt que de le supprimer."
    );
  }
  if ((await prisma.serviceDefinition.count({ where: { establishmentId: ctx.establishment.id } })) <= 1) {
    throw new Error("Il faut garder au moins un service.");
  }

  await prisma.serviceDefinition.delete({ where: { id } });
  revalidate();
}
