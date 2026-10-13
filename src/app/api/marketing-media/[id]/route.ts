import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { readMarketingMedia } from "@/lib/marketing-media-storage";

/// Seul point d'accès à une photo de publication : jamais servie depuis public/, réservée aux
/// membres de l'établissement qui peuvent voir la communication.
const EXTENSION_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/// Nom de fichier lisible tiré du titre ("Plat du jour !" → "plat-du-jour"), jamais un chemin.
function downloadName(title: string, mime: string) {
  const base =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "photo";
  return `${base}.${EXTENSION_BY_MIME[mime] ?? "jpg"}`;
}

export async function GET(request: Request, ctx: RouteContext<"/api/marketing-media/[id]">) {
  const { id } = await ctx.params;
  const context = await getCurrentContext();
  if (!context.can("marketing.view")) return new Response("Accès refusé.", { status: 403 });

  const post = await prisma.marketingPost.findFirst({
    where: { id, establishmentId: context.establishment.id },
    select: { title: true, mediaFileName: true, mediaMimeType: true },
  });
  if (!post?.mediaFileName || !post.mediaMimeType) return new Response("Introuvable.", { status: 404 });

  const buffer = await readMarketingMedia(post.mediaFileName).catch(() => null);
  if (!buffer) return new Response("Introuvable.", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": post.mediaMimeType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
      ...(download ? { "Content-Disposition": `attachment; filename="${downloadName(post.title, post.mediaMimeType)}"` } : {}),
    },
  });
}
