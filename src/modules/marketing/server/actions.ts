"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import {
  EditorialLineSchema,
  PostSchema,
  PostStatsSchema,
  type EditorialLineInput,
  type PostInput,
  type PostStatsInput,
} from "@/modules/marketing/server/shared";

function revalidateMarketingPaths() {
  revalidatePath("/marketing");
}

export async function createPost(input: PostInput) {
  const ctx = await requirePermission("marketing.publish");
  const data = PostSchema.parse(input);

  if (data.editorialLineId) {
    const line = await prisma.editorialLine.findFirst({ where: { id: data.editorialLineId, establishmentId: ctx.establishment.id } });
    if (!line) throw new Error("Ligne éditoriale introuvable.");
  }

  await prisma.marketingPost.create({
    data: {
      establishmentId: ctx.establishment.id,
      title: data.title,
      content: data.content,
      mediaNote: data.mediaNote || null,
      channel: data.channel,
      scheduledFor: new Date(`${data.scheduledDate}T${data.scheduledTime}:00`),
      status: data.status,
      subject: data.subject?.trim() || null,
      editorialLineId: data.editorialLineId || null,
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

  await prisma.marketingPost.update({ where: { id }, data: { status: "published", publishedAt: new Date() } });
  revalidateMarketingPaths();
}

export async function deletePost(id: string) {
  const ctx = await requirePermission("marketing.publish");
  const existing = await prisma.marketingPost.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Publication introuvable.");

  await prisma.marketingPost.delete({ where: { id } });
  revalidateMarketingPaths();
}

/// Résultats d'une publication déjà publiée (j'aime, commentaires, portée), saisis à la main.
export async function updatePostStats(id: string, input: PostStatsInput) {
  const ctx = await requirePermission("marketing.publish");
  const data = PostStatsSchema.parse(input);
  const existing = await prisma.marketingPost.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Publication introuvable.");
  if (existing.status !== "published") throw new Error("Les résultats se saisissent une fois la publication publiée.");

  await prisma.marketingPost.update({ where: { id }, data });
  revalidateMarketingPaths();
}

export async function createEditorialLine(input: EditorialLineInput) {
  const ctx = await requirePermission("marketing.publish");
  const data = EditorialLineSchema.parse(input);
  await prisma.editorialLine.create({
    data: {
      establishmentId: ctx.establishment.id,
      name: data.name,
      audience: data.audience || null,
      tone: data.tone || null,
      themes: data.themes || null,
      avoid: data.avoid || null,
      hashtags: data.hashtags || null,
    },
  });
  revalidateMarketingPaths();
}

export async function updateEditorialLine(id: string, input: EditorialLineInput) {
  const ctx = await requirePermission("marketing.publish");
  const data = EditorialLineSchema.parse(input);
  const existing = await prisma.editorialLine.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Ligne éditoriale introuvable.");
  await prisma.editorialLine.update({
    where: { id },
    data: {
      name: data.name,
      audience: data.audience || null,
      tone: data.tone || null,
      themes: data.themes || null,
      avoid: data.avoid || null,
      hashtags: data.hashtags || null,
    },
  });
  revalidateMarketingPaths();
}

/// Supprimer une ligne ne supprime pas les publications qui la suivaient : elles perdent juste ce rattachement.
export async function deleteEditorialLine(id: string) {
  const ctx = await requirePermission("marketing.publish");
  const existing = await prisma.editorialLine.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Ligne éditoriale introuvable.");
  await prisma.editorialLine.delete({ where: { id } });
  revalidateMarketingPaths();
}
