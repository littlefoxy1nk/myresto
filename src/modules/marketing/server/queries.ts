import { prisma } from "@/lib/prisma";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import type { MarketingChannel, MarketingPostItem, MarketingPostStatus } from "@/modules/marketing/types";

function toItem(p: {
  id: string;
  title: string;
  content: string;
  mediaFileName: string | null;
  channel: string;
  scheduledFor: Date;
  status: string;
  createdAt: Date;
}): MarketingPostItem {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    mediaUrl: p.mediaFileName ? `/api/marketing-media/${p.id}` : null,
    channel: p.channel as MarketingChannel,
    scheduledFor: p.scheduledFor.toISOString(),
    status: p.status as MarketingPostStatus,
    createdAt: p.createdAt.toISOString(),
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
  });

  return posts.map(toItem);
}
