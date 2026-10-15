import { prisma } from "@/lib/prisma";
import { isNotificationMuted } from "@/lib/notification-preferences";

export type NotificationType =
  | "shift_changed"
  | "shift_cancelled"
  | "leave_approved"
  | "leave_rejected"
  | "leave_requested"
  | "replacement_needed"
  | "availability_changed"
  | "coverage_requested"
  | "coverage_accepted"
  | "coverage_declined"
  | "reservation_request";
export type NotificationSeverity = "urgent" | "important" | "watch";

/// Point d'entrée unique pour créer une notification personnelle — utilisé par
/// planning (changement d'horaire) et timeoff (décision de congé, nouvelle demande).
/// Toujours factuel ("votre horaire a changé"), jamais une recommandation. `severity`
/// n'a pas de valeur par défaut : chaque site d'appel doit choisir consciemment, dans
/// la même taxonomie urgent/important/watch qu'ailleurs dans l'app.
export async function notifyMember(params: {
  establishmentId: string;
  membershipId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  linkHref?: string;
}) {
  // La personne a coupé cette catégorie dans Paramètres → Notifications : on ne la crée même pas.
  const member = await prisma.membership.findUnique({
    where: { id: params.membershipId },
    select: { mutedNotificationCategories: true },
  });
  if (member && isNotificationMuted(member.mutedNotificationCategories, params.type)) return;

  await prisma.notification.create({
    data: {
      establishmentId: params.establishmentId,
      membershipId: params.membershipId,
      type: params.type,
      severity: params.severity,
      title: params.title,
      body: params.body ?? null,
      linkHref: params.linkHref ?? null,
    },
  });
}
