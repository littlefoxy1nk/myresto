import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "shift_changed"
  | "shift_cancelled"
  | "leave_approved"
  | "leave_rejected"
  | "leave_requested"
  | "replacement_needed";
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
