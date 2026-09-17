"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { notifyMember } from "@/modules/myspace/server/notify";

function revalidateTimeOffPaths() {
  // Une décision de congé change immédiatement ce que le Planning doit signaler
  // (personne planifiée pendant une absence) et l'alerte d'absence du jour.
  revalidatePath("/conges");
  revalidatePath("/planning");
  revalidatePath("/aujourdhui");
}

async function findPendingRequest(establishmentId: string, id: string) {
  const request = await prisma.timeOffRequest.findFirst({ where: { id, establishmentId } });
  if (!request) throw new Error("Demande introuvable.");
  if (request.status !== "pending") throw new Error("Cette demande a déjà été traitée.");
  return request;
}

export async function approveTimeOffRequest(id: string) {
  const ctx = await requirePermission("timeoff.manage");
  const request = await findPendingRequest(ctx.establishment.id, id);

  await prisma.timeOffRequest.update({
    where: { id },
    data: { status: "approved", reviewedById: ctx.user.id },
  });

  await notifyMember({
    establishmentId: ctx.establishment.id,
    membershipId: request.membershipId,
    type: "leave_approved",
    severity: "urgent",
    title: request.kind === "maladie" ? "Votre arrêt maladie a été enregistré" : "Votre demande de congé a été acceptée",
    body: `Du ${toDateKey(request.startDate)} au ${toDateKey(request.endDate)}.`,
    linkHref: "/mon-espace",
  });

  revalidateTimeOffPaths();
}

export async function rejectTimeOffRequest(id: string) {
  const ctx = await requirePermission("timeoff.manage");
  const request = await findPendingRequest(ctx.establishment.id, id);

  await prisma.timeOffRequest.update({
    where: { id },
    data: { status: "rejected", reviewedById: ctx.user.id },
  });

  await notifyMember({
    establishmentId: ctx.establishment.id,
    membershipId: request.membershipId,
    type: "leave_rejected",
    severity: "urgent",
    title: request.kind === "maladie" ? "Votre arrêt maladie a été contesté" : "Votre demande de congé a été refusée",
    body: `Du ${toDateKey(request.startDate)} au ${toDateKey(request.endDate)}.`,
    linkHref: "/mon-espace",
  });

  revalidateTimeOffPaths();
}
