"use server";

import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentContext, requirePermission } from "@/lib/current-context";
import { notifyMember } from "@/modules/myspace/server/notify";
import { getEligibleCandidatesForShift } from "@/modules/replacement/server/queries";

function revalidateReplacementPaths() {
  revalidatePath("/mon-espace");
  revalidatePath("/planning");
}

/// Un employé signale qu'il ne peut pas assurer un shift déjà planifié — jamais pour un
/// tiers (le shift doit lui appartenir). Ne l'annule pas : le manager reste seul décideur
/// de la suite (voir resolveReplacementRequest), ce dépôt ne fait que lancer la recherche.
export async function requestReplacement(shiftId: string, reason?: string) {
  const ctx = await getCurrentContext();

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, establishmentId: ctx.establishment.id, membershipId: ctx.membership.id },
  });
  if (!shift) throw new Error("Service introuvable.");
  if (shift.status === "cancelled") throw new Error("Ce service est déjà annulé.");
  if (startOfDay(shift.date).getTime() < startOfDay(new Date()).getTime()) {
    throw new Error("Impossible de demander un remplacement pour un service déjà passé.");
  }

  const existingOpen = await prisma.replacementRequest.findFirst({ where: { shiftId, status: "open" } });
  if (existingOpen) throw new Error("Un remplacement est déjà en cours pour ce service.");

  await prisma.replacementRequest.create({
    data: {
      establishmentId: ctx.establishment.id,
      shiftId,
      requestedById: ctx.membership.id,
      reason: reason?.trim() || null,
    },
  });

  const candidates = await getEligibleCandidatesForShift(ctx.establishment.id, shift);
  const memberName = `${ctx.user.firstName} ${ctx.user.lastName}`;
  await Promise.all(
    candidates.map((c) =>
      notifyMember({
        establishmentId: ctx.establishment.id,
        membershipId: c.membershipId,
        type: "replacement_needed",
        severity: "important",
        title: `${memberName} cherche un remplacement`,
        body: `${shift.startTime}–${shift.endTime}`,
        linkHref: "/mon-espace",
      })
    )
  );

  revalidateReplacementPaths();
}

/// Se proposer pour un remplacement — jamais pour un tiers. Vérifie à nouveau
/// l'éligibilité côté serveur (poste/compétences, chevauchement, congé) : l'affichage
/// côté client ne suffit pas à garantir que la situation n'a pas changé entre-temps.
export async function volunteerForReplacement(requestId: string) {
  const ctx = await getCurrentContext();

  const request = await prisma.replacementRequest.findFirst({
    where: { id: requestId, establishmentId: ctx.establishment.id, status: "open" },
    include: { shift: true },
  });
  if (!request) throw new Error("Remplacement introuvable.");
  if (request.requestedById === ctx.membership.id) throw new Error("Vous ne pouvez pas remplacer votre propre service.");

  const candidates = await getEligibleCandidatesForShift(ctx.establishment.id, request.shift);
  if (!candidates.some((c) => c.membershipId === ctx.membership.id)) {
    throw new Error("Vous n'êtes pas éligible pour ce remplacement.");
  }

  await prisma.replacementVolunteer.upsert({
    where: { replacementRequestId_membershipId: { replacementRequestId: requestId, membershipId: ctx.membership.id } },
    create: { replacementRequestId: requestId, membershipId: ctx.membership.id },
    update: {},
  });

  revalidateReplacementPaths();
}

/// Le manager assigne le shift à l'une des personnes factuellement éligibles — jamais
/// une assignation automatique, même s'il n'y a qu'un seul volontaire. Réutilise la
/// même mise à jour que le Planning (réassignation de shift.membershipId), qui notifie
/// déjà l'ancienne et la nouvelle personne — voir planning/server/actions.ts.
export async function resolveReplacementRequest(requestId: string, newMembershipId: string) {
  const ctx = await requirePermission("schedule.edit");

  const request = await prisma.replacementRequest.findFirst({
    where: { id: requestId, establishmentId: ctx.establishment.id, status: "open" },
    include: { shift: true },
  });
  if (!request) throw new Error("Remplacement introuvable.");

  const candidates = await getEligibleCandidatesForShift(ctx.establishment.id, request.shift);
  if (!candidates.some((c) => c.membershipId === newMembershipId)) {
    throw new Error("Cette personne n'est pas éligible pour ce remplacement.");
  }

  const previousMembershipId = request.shift.membershipId;

  await prisma.shift.update({ where: { id: request.shiftId }, data: { membershipId: newMembershipId } });
  await prisma.replacementRequest.update({
    where: { id: requestId },
    data: { status: "resolved", resolvedMembershipId: newMembershipId },
  });

  await notifyMember({
    establishmentId: ctx.establishment.id,
    membershipId: newMembershipId,
    type: "shift_changed",
    severity: "urgent",
    title: "Un nouveau service vous a été attribué",
    body: `${request.shift.startTime}–${request.shift.endTime}`,
    linkHref: "/mon-espace",
  });
  if (previousMembershipId !== newMembershipId) {
    await notifyMember({
      establishmentId: ctx.establishment.id,
      membershipId: previousMembershipId,
      type: "shift_changed",
      severity: "urgent",
      title: "Votre service a été repris par quelqu'un d'autre",
      body: `${request.shift.startTime}–${request.shift.endTime}`,
      linkHref: "/mon-espace",
    });
  }

  revalidateReplacementPaths();
}
