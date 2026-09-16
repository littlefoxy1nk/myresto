import { prisma } from "@/lib/prisma";

export type NotificationType = "shift_changed" | "shift_cancelled" | "leave_approved" | "leave_rejected" | "leave_requested";

/// Point d'entrée unique pour créer une notification personnelle — utilisé par
/// planning (changement d'horaire) et timeoff (décision de congé, nouvelle demande).
/// Toujours factuel ("votre horaire a changé"), jamais une recommandation.
export async function notifyMember(params: {
  establishmentId: string;
  membershipId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkHref?: string;
}) {
  await prisma.notification.create({
    data: {
      establishmentId: params.establishmentId,
      membershipId: params.membershipId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      linkHref: params.linkHref ?? null,
    },
  });
}
