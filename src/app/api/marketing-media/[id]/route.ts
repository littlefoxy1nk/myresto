import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { readMarketingMedia } from "@/lib/marketing-media-storage";

/// Seul point d'accès à une photo de publication : jamais servie depuis public/, réservée aux
/// membres de l'établissement qui peuvent voir la communication.
export async function GET(_request: Request, ctx: RouteContext<"/api/marketing-media/[id]">) {
  const { id } = await ctx.params;
  const context = await getCurrentContext();
  if (!context.can("marketing.view")) return new Response("Accès refusé.", { status: 403 });

  const post = await prisma.marketingPost.findFirst({
    where: { id, establishmentId: context.establishment.id },
    select: { mediaFileName: true, mediaMimeType: true },
  });
  if (!post?.mediaFileName || !post.mediaMimeType) return new Response("Introuvable.", { status: 404 });

  const buffer = await readMarketingMedia(post.mediaFileName).catch(() => null);
  if (!buffer) return new Response("Introuvable.", { status: 404 });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": post.mediaMimeType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
