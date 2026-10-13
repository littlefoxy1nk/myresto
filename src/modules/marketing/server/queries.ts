import { prisma } from "@/lib/prisma";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import type { EditorialLineItem, MarketingChannel, MarketingPostItem, MarketingPostStatus } from "@/modules/marketing/types";

function toItem(p: {
  id: string;
  title: string;
  content: string;
  mediaNote: string | null;
  channel: string;
  scheduledFor: Date;
  status: string;
  createdAt: Date;
  subject: string | null;
  editorialLineId: string | null;
  editorialLine: { name: string } | null;
  publishedAt: Date | null;
  likes: number | null;
  comments: number | null;
  reach: number | null;
}): MarketingPostItem {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    mediaNote: p.mediaNote,
    channel: p.channel as MarketingChannel,
    scheduledFor: p.scheduledFor.toISOString(),
    status: p.status as MarketingPostStatus,
    createdAt: p.createdAt.toISOString(),
    subject: p.subject,
    editorialLineId: p.editorialLineId,
    editorialLineName: p.editorialLine?.name ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    likes: p.likes,
    comments: p.comments,
    reach: p.reach,
  };
}

/// Le calendrier éditorial complet de l'établissement — pas de fenêtre glissante ici,
/// un établissement en a naturellement peu (des dizaines, pas des milliers) et le
/// patron doit pouvoir revoir aussi bien ce qui vient que ce qui a déjà été publié.
export async function getMarketingPosts(): Promise<MarketingPostItem[]> {
  const ctx = await getCurrentContext();
  if (!ctx.can("marketing.view")) throw new ForbiddenError("marketing.view");

  const posts = await prisma.marketingPost.findMany({
    where: { establishmentId: ctx.establishment.id },
    orderBy: { scheduledFor: "asc" },
    include: { editorialLine: { select: { name: true } } },
  });

  return posts.map(toItem);
}

export async function getEditorialLines(): Promise<EditorialLineItem[]> {
  const ctx = await getCurrentContext();
  if (!ctx.can("marketing.view")) throw new ForbiddenError("marketing.view");

  const lines = await prisma.editorialLine.findMany({
    where: { establishmentId: ctx.establishment.id },
    orderBy: { createdAt: "asc" },
  });
  return lines.map((l) => ({
    id: l.id,
    name: l.name,
    audience: l.audience,
    tone: l.tone,
    themes: l.themes,
    avoid: l.avoid,
    hashtags: l.hashtags,
  }));
}
