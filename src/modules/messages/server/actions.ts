"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NOT_SUPPORT } from "@/lib/assistance";
import { getCurrentContext, requireAnyPermission } from "@/lib/current-context";
import { notifyMember } from "@/modules/myspace/server/notify";
import { memberInAudience } from "@/modules/messages/audience";

const PostSchema = z.object({
  title: z.string().trim().min(1, "Écris un titre.").max(80, "80 caractères maximum pour le titre."),
  body: z.string().trim().max(1000, "1000 caractères maximum.").default(""),
  audience: z.enum(["all", "salle", "cuisine"]),
});

export type PostResult = { ok: true; sentTo: number } | { ok: false; error: string };

/// Le responsable écrit à son équipe. Réservé à qui gère l'équipe ou le planning. Chaque personne concernée reçoit une
/// notification (dans l'appli, et sur son téléphone si elle l'a activé) et peut répondre « J'ai lu ».
export async function postAnnouncement(input: z.input<typeof PostSchema>): Promise<PostResult> {
  const ctx = await requireAnyPermission("staff.manage", "schedule.edit");
  const parsed = PostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Message invalide." };
  const data = parsed.data;

  const authorName = ctx.assistance ? "Assistance MYRESTO" : `${ctx.user.firstName} ${ctx.user.lastName}`;
  await prisma.announcement.create({
    data: {
      establishmentId: ctx.establishment.id,
      authorId: ctx.membership.id,
      authorName,
      title: data.title,
      body: data.body,
      audience: data.audience,
    },
  });

  const members = await prisma.membership.findMany({
    where: { establishmentId: ctx.establishment.id, status: "active", id: { not: ctx.membership.id }, ...NOT_SUPPORT },
    select: { id: true, skills: true },
  });
  const recipients = members.filter((m) => memberInAudience(data.audience, m));
  await Promise.all(
    recipients.map((m) =>
      notifyMember({
        establishmentId: ctx.establishment.id,
        membershipId: m.id,
        type: "announcement",
        severity: "important",
        title: `${authorName.split(" ")[0]} : ${data.title}`,
        body: data.body ? data.body.slice(0, 140) : undefined,
        linkHref: "/messages",
      })
    )
  );

  revalidatePath("/messages");
  revalidatePath("/aujourdhui");
  return { ok: true, sentTo: recipients.length };
}

/// La cloche ne doit plus signaler un message déjà lu.
async function clearMessageNotifications(membershipId: string) {
  await prisma.notification.updateMany({ where: { membershipId, type: "announcement", readAt: null }, data: { readAt: new Date() } });
}

/// « J'ai lu » : seulement pour un message de son propre établissement et qui s'adresse à soi.
export async function markAnnouncementRead(announcementId: string): Promise<void> {
  const ctx = await getCurrentContext();
  const announcement = await prisma.announcement.findFirst({ where: { id: announcementId, establishmentId: ctx.establishment.id } });
  if (!announcement) throw new Error("Message introuvable.");
  if (!memberInAudience(announcement.audience, ctx.membership)) return;
  await prisma.announcementRead.upsert({
    where: { announcementId_membershipId: { announcementId, membershipId: ctx.membership.id } },
    create: { announcementId, membershipId: ctx.membership.id },
    update: {},
  });
  await clearMessageNotifications(ctx.membership.id);
  revalidatePath("/messages");
  revalidatePath("/aujourdhui");
}

export async function markAllAnnouncementsRead(): Promise<void> {
  const ctx = await getCurrentContext();
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const items = await prisma.announcement.findMany({
    where: { establishmentId: ctx.establishment.id, createdAt: { gte: since }, reads: { none: { membershipId: ctx.membership.id } } },
    select: { id: true, audience: true },
  });
  const mine = items.filter((a) => memberInAudience(a.audience, ctx.membership));
  if (mine.length > 0) {
    await prisma.announcementRead.createMany({ data: mine.map((a) => ({ announcementId: a.id, membershipId: ctx.membership.id })), skipDuplicates: true });
  }
  await clearMessageNotifications(ctx.membership.id);
  revalidatePath("/messages");
  revalidatePath("/aujourdhui");
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const ctx = await requireAnyPermission("staff.manage", "schedule.edit");
  const announcement = await prisma.announcement.findFirst({ where: { id: announcementId, establishmentId: ctx.establishment.id } });
  if (!announcement) throw new Error("Message introuvable.");
  await prisma.announcement.delete({ where: { id: announcementId } });
  revalidatePath("/messages");
  revalidatePath("/aujourdhui");
}
