import { prisma } from "@/lib/prisma";
import { NOT_SUPPORT } from "@/lib/assistance";
import { getCurrentContext } from "@/lib/current-context";
import { memberInAudience } from "@/modules/messages/audience";

export type MessageItem = {
  id: string;
  authorName: string;
  title: string;
  body: string;
  audience: string;
  createdAt: string;
  read: boolean;
  /// Seulement pour qui peut écrire : qui a lu, qui n'a pas encore lu.
  receipts: { readCount: number; total: number; pendingNames: string[] } | null;
};

const WINDOW_DAYS = 60;

function since() {
  return new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/// Les messages des 60 derniers jours qui concernent la personne connectée. Celui ou celle qui peut écrire voit tous
/// les messages et, pour chacun, qui l'a lu.
export async function getMessages(canPost: boolean): Promise<MessageItem[]> {
  const ctx = await getCurrentContext();
  const rows = await prisma.announcement.findMany({
    where: { establishmentId: ctx.establishment.id, createdAt: { gte: since() } },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { reads: { select: { membershipId: true } } },
  });

  const members = canPost
    ? await prisma.membership.findMany({
        where: { establishmentId: ctx.establishment.id, status: "active", ...NOT_SUPPORT },
        select: { id: true, skills: true, user: { select: { firstName: true } } },
      })
    : [];

  return rows
    .filter((a) => canPost || memberInAudience(a.audience, ctx.membership))
    .map((a) => {
      const readIds = new Set(a.reads.map((r) => r.membershipId));
      let receipts: MessageItem["receipts"] = null;
      if (canPost) {
        const audience = members.filter((m) => m.id !== a.authorId && memberInAudience(a.audience, m));
        receipts = {
          total: audience.length,
          readCount: audience.filter((m) => readIds.has(m.id)).length,
          pendingNames: audience.filter((m) => !readIds.has(m.id)).map((m) => m.user.firstName),
        };
      }
      return {
        id: a.id,
        authorName: a.authorName,
        title: a.title,
        body: a.body,
        audience: a.audience,
        createdAt: a.createdAt.toISOString(),
        // Ses propres messages comptent comme lus.
        read: readIds.has(ctx.membership.id) || a.authorId === ctx.membership.id,
        receipts,
      };
    });
}

/// Combien de messages la personne n'a pas encore lus (pour l'invitation sur Aujourd'hui).
export async function getUnreadMessageCount(): Promise<number> {
  const ctx = await getCurrentContext();
  const rows = await prisma.announcement.findMany({
    where: {
      establishmentId: ctx.establishment.id,
      createdAt: { gte: since() },
      // authorId peut être vide (auteur parti de l'équipe) : un simple « NOT » écarterait alors ces messages.
      OR: [{ authorId: null }, { authorId: { not: ctx.membership.id } }],
      reads: { none: { membershipId: ctx.membership.id } },
    },
    select: { audience: true },
  });
  return rows.filter((a) => memberInAudience(a.audience, ctx.membership)).length;
}
