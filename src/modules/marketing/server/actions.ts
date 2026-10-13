"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { detectImageType, MAX_IMAGE_BYTES } from "@/lib/image-type";
import { deleteMarketingMedia, saveMarketingMedia } from "@/lib/marketing-media-storage";
import { PostSchema, type PostInput } from "@/modules/marketing/server/shared";

function revalidateMarketingPaths() {
  revalidatePath("/marketing");
}

export async function createPost(input: PostInput) {
  const ctx = await requirePermission("marketing.publish");
  const data = PostSchema.parse(input);

  const created = await prisma.marketingPost.create({
    data: {
      establishmentId: ctx.establishment.id,
      title: data.title,
      content: data.content,
      channel: data.channel,
      scheduledFor: new Date(`${data.scheduledDate}T${data.scheduledTime}:00`),
      status: data.status,
    },
  });

  revalidateMarketingPaths();
  return created.id;
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
  if (existing.mediaFileName) await deleteMarketingMedia(existing.mediaFileName);
  revalidateMarketingPaths();
}

/// Ajoute (ou remplace) la photo d'une publication. Le type est lu dans le fichier lui-même
/// (JPEG, PNG ou WebP), pas dans ce que le navigateur annonce.
export async function uploadPostPhoto(formData: FormData) {
  const ctx = await requirePermission("marketing.publish");
  const id = String(formData.get("postId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Aucune photo choisie.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Photo trop lourde (5 Mo maximum).");

  const existing = await prisma.marketingPost.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Publication introuvable.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const type = detectImageType(buffer);
  if (!type) throw new Error("Format non accepté (JPEG, PNG ou WebP uniquement).");

  const fileName = await saveMarketingMedia(buffer, type.extension);
  await prisma.marketingPost.update({ where: { id }, data: { mediaFileName: fileName, mediaMimeType: type.mime } });
  if (existing.mediaFileName) await deleteMarketingMedia(existing.mediaFileName);
  revalidateMarketingPaths();
}

export async function removePostPhoto(id: string) {
  const ctx = await requirePermission("marketing.publish");
  const existing = await prisma.marketingPost.findFirst({ where: { id, establishmentId: ctx.establishment.id } });
  if (!existing) throw new Error("Publication introuvable.");
  if (!existing.mediaFileName) return;

  await prisma.marketingPost.update({ where: { id }, data: { mediaFileName: null, mediaMimeType: null } });
  await deleteMarketingMedia(existing.mediaFileName);
  revalidateMarketingPaths();
}
