"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/current-context";
import { notifyMember } from "@/modules/myspace/server/notify";

function revalidateMyPaths() {
  revalidatePath("/mon-espace");
  revalidatePath("/conges");
  revalidatePath("/planning");
}

const RequestTimeOffSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(200).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: "La date de fin doit suivre la date de début.", path: ["endDate"] });

/// Dépôt d'une demande par l'employé lui-même — jamais pour un tiers : membershipId
/// vient toujours de ctx, jamais d'un champ du formulaire. Statut "pending" : seule
/// timeoff.manage (voir timeoff/server/actions.ts) peut ensuite l'accepter ou la
/// refuser, ce dépôt ne décide de rien.
export async function requestTimeOff(input: z.infer<typeof RequestTimeOffSchema>) {
  const ctx = await getCurrentContext();
  const data = RequestTimeOffSchema.parse(input);

  await prisma.timeOffRequest.create({
    data: {
      establishmentId: ctx.establishment.id,
      membershipId: ctx.membership.id,
      startDate: new Date(`${data.startDate}T00:00:00`),
      endDate: new Date(`${data.endDate}T00:00:00`),
      reason: data.reason || null,
      status: "pending",
    },
  });

  const managers = await prisma.membership.findMany({
    where: {
      establishmentId: ctx.establishment.id,
      status: "active",
      id: { not: ctx.membership.id },
      role: { permissions: { some: { permission: { key: "timeoff.manage" } } } },
    },
  });
  const memberName = `${ctx.user.firstName} ${ctx.user.lastName}`;
  await Promise.all(
    managers.map((m) =>
      notifyMember({
        establishmentId: ctx.establishment.id,
        membershipId: m.id,
        type: "leave_requested",
        title: `${memberName} a demandé un congé`,
        body: `Du ${data.startDate} au ${data.endDate}${data.reason ? ` — ${data.reason}` : ""}.`,
        linkHref: "/conges",
      })
    )
  );

  revalidateMyPaths();
}

const ChangeCodeSchema = z
  .object({
    currentCode: z.string().min(1, "Code actuel requis."),
    newCode: z.string().regex(/^\d{4,8}$/, "Le nouveau code doit contenir entre 4 et 8 chiffres."),
  });

/// Un employé change son propre code — jamais celui d'un tiers (aucun membershipId en
/// paramètre). Exige l'ancien code : un compte déjà ouvert sur un poste partagé ne doit
/// pas permettre à qui passe devant l'écran de changer le code de quelqu'un d'autre.
export async function changeMyCode(input: z.infer<typeof ChangeCodeSchema>) {
  const ctx = await getCurrentContext();
  const data = ChangeCodeSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!user?.codeHash) throw new Error("Ce compte n'utilise pas de code d'accès.");

  const valid = await bcrypt.compare(data.currentCode, user.codeHash);
  if (!valid) throw new Error("Code actuel incorrect.");

  const codeHash = await bcrypt.hash(data.newCode, 10);
  await prisma.user.update({ where: { id: ctx.user.id }, data: { codeHash } });
}

/// Indisponibilité déclarée pour un jour de semaine entier — la même notion que
/// isDayGenerallyUnavailable (planning/compute.ts), pour rester cohérent avec ce que
/// le moteur d'objectifs consomme déjà. Ne gère pas les plages horaires précises
/// ("disponible seulement le soir") : une évolution possible, pas construite ici.
export async function setMyDayUnavailability(dayOfWeek: number, unavailable: boolean) {
  const ctx = await getCurrentContext();
  if (dayOfWeek < 1 || dayOfWeek > 7) throw new Error("Jour invalide.");

  await prisma.availability.deleteMany({
    where: { membershipId: ctx.membership.id, dayOfWeek, kind: "unavailable", startTime: null, endTime: null },
  });

  if (unavailable) {
    await prisma.availability.create({
      data: { establishmentId: ctx.establishment.id, membershipId: ctx.membership.id, dayOfWeek, kind: "unavailable" },
    });
  }

  revalidatePath("/mon-espace");
  revalidatePath("/planning");
}

export async function markNotificationRead(notificationId: string) {
  const ctx = await getCurrentContext();
  await prisma.notification.updateMany({
    where: { id: notificationId, membershipId: ctx.membership.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/mon-espace");
}

export async function markAllNotificationsRead() {
  const ctx = await getCurrentContext();
  await prisma.notification.updateMany({
    where: { membershipId: ctx.membership.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/mon-espace");
}
