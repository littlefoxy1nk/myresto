"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { PostSchema, type PostInput } from "@/modules/marketing/server/shared";

function revalidateMarketingPaths() {
  revalidatePath("/marketing");
}

export async function createPost(input: PostInput) {
  const ctx = await requirePermission("marketing.publish");
  const data = PostSchema.parse(input);

  await prisma.marketingPost.create({
    data: {
      establishmentId: ctx.establishment.id,
      title: data.title,
      content: data.content,
      mediaNote: data.mediaNote || null,
      channel: data.channel,
      scheduledFor: new Date(`${data.scheduledDate}T${data.scheduledTime}:00`),
      status: data.status,
    },
  });

  revalidateMarketingPaths();
}

export async function updatePost(id: string, input: PostInput) {
  const ctx = await requirePermission("marketing.publish");
  const data = PostSchema.parse(input);

  const existing = await prisma.marketingPost.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Publication introuvable.");
  if (existing.status === "published") throw new Error("Une publication déjà publiée ne peut plus être modifiée.");

  await prisma.marketingPost.update({
    where: { id },
    data: {
      title: data.title,
      content: data.content,
      mediaNote: data.mediaNote || null,
      channel: data.channel,
      scheduledFor: new Date(`${data.scheduledDate}T${data.scheduledTime}:00`),
      status: data.status,
    },
  });

  revalidateMarketingPaths();
}

/// Transition manuelle, jamais automatique — voir le principe "pas de publication
/// automatisée" de la phase. Un humain a réellement publié sur le réseau, puis vient
/// le dire à MYRESTO.
export async function markPostPublished(id: string) {
  const ctx = await requirePermission("marketing.publish");
  const existing = await prisma.marketingPost.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Publication introuvable.");

  await prisma.marketingPost.update({ where: { id }, data: { status: "published" } });
  revalidateMarketingPaths();
}

export async function deletePost(id: string) {
  const ctx = await requirePermission("marketing.publish");
  const existing = await prisma.marketingPost.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Publication introuvable.");

  await prisma.marketingPost.delete({ where: { id } });
  revalidateMarketingPaths();
}
