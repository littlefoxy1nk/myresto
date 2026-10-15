"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { startOfDay, startOfWeek, endOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/current-context";
import { toDateKey } from "@/lib/utils";
import { isoWeekday } from "@/lib/time";
import { notifyMember } from "@/modules/myspace/server/notify";
import { saveEmployeeDocument, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/employee-document-storage";

function revalidateMyPaths() {
  revalidatePath("/mon-espace");
  revalidatePath("/conges");
  revalidatePath("/planning");
}

/// Notifie qui construit le planning (schedule.edit) d'un changement de disponibilité
/// venant de l'employé lui-même — un manager qui n'édite pas le planning n'a pas
/// besoin de le savoir immédiatement, il le verra de toute façon sur la fiche employé.
async function notifyScheduleEditors(establishmentId: string, excludeMembershipId: string, title: string, body: string) {
  const editors = await prisma.membership.findMany({
    where: {
      establishmentId,
      status: "active",
      id: { not: excludeMembershipId },
      role: { permissions: { some: { permission: { key: "schedule.edit" } } } },
    },
  });
  await Promise.all(
    editors.map((m) =>
      notifyMember({
        establishmentId,
        membershipId: m.id,
        type: "availability_changed",
        severity: "watch",
        title,
        body,
        linkHref: "/planning",
      })
    )
  );
}

const RequestTimeOffSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(200).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: "La date de fin doit suivre la date de début.", path: ["endDate"] });

/// Dépôt d'une demande par l'employé lui-même — jamais pour un tiers : membershipId
/// vient toujours de ctx, jamais d'un champ du formulaire. Statut "pending" : seule
/// timeoff.manage (voir timeoff/server/actions.ts) peut ensuite l'accepter ou la
/// refuser, ce dépôt ne décide de rien.
export async function requestTimeOff(input: z.infer<typeof RequestTimeOffSchema>) {
  const ctx = await getCurrentContext();
  const data = RequestTimeOffSchema.parse(input);

  await prisma.timeOffRequest.create({
    data: {
      establishmentId: ctx.establishment.id,
      membershipId: ctx.membership.id,
      startDate: new Date(`${data.startDate}T00:00:00`),
      endDate: new Date(`${data.endDate}T00:00:00`),
      reason: data.reason || null,
      status: "pending",
    },
  });

  const managers = await prisma.membership.findMany({
    where: {
      establishmentId: ctx.establishment.id,
      status: "active",
      id: { not: ctx.membership.id },
      role: { permissions: { some: { permission: { key: "timeoff.manage" } } } },
    },
  });
  const memberName = `${ctx.user.firstName} ${ctx.user.lastName}`;
  await Promise.all(
    managers.map((m) =>
      notifyMember({
        establishmentId: ctx.establishment.id,
        membershipId: m.id,
        type: "leave_requested",
        severity: "important",
        title: `${memberName} a demandé un congé`,
        body: `Du ${data.startDate} au ${data.endDate}${data.reason ? ` — ${data.reason}` : ""}.`,
        linkHref: "/conges",
      })
    )
  );

  revalidateMyPaths();
}

const DeclareSickLeaveSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(200).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: "La date de fin doit suivre la date de début.", path: ["endDate"] });

/// Une maladie n'est pas un congé qu'on demande à l'avance : c'est un fait déclaré,
/// que le manager doit "traiter" (voir approveTimeOffRequest) plutôt qu'accepter au
/// sens propre — d'où kind: "maladie" plutôt qu'une décision différente à créer. Le
/// certificat médical (optionnel, jamais obligatoire) s'attache à cette même demande,
/// voir Étape 4.
export async function declareSickLeave(input: z.infer<typeof DeclareSickLeaveSchema>) {
  const ctx = await getCurrentContext();
  const data = DeclareSickLeaveSchema.parse(input);

  await prisma.timeOffRequest.create({
    data: {
      establishmentId: ctx.establishment.id,
      membershipId: ctx.membership.id,
      startDate: new Date(`${data.startDate}T00:00:00`),
      endDate: new Date(`${data.endDate}T00:00:00`),
      reason: data.reason || null,
      kind: "maladie",
      status: "pending",
    },
  });

  const managers = await prisma.membership.findMany({
    where: {
      establishmentId: ctx.establishment.id,
      status: "active",
      id: { not: ctx.membership.id },
      role: { permissions: { some: { permission: { key: "timeoff.manage" } } } },
    },
  });
  const memberName = `${ctx.user.firstName} ${ctx.user.lastName}`;
  await Promise.all(
    managers.map((m) =>
      notifyMember({
        establishmentId: ctx.establishment.id,
        membershipId: m.id,
        type: "leave_requested",
        severity: "urgent",
        title: `${memberName} a signalé une absence maladie`,
        body: `Du ${data.startDate} au ${data.endDate}${data.reason ? ` — ${data.reason}` : ""}.`,
        linkHref: "/conges",
      })
    )
  );

  revalidateMyPaths();
}

/// Le certificat s'attache à une absence maladie précise, jamais uploadé "à part" —
/// voir la décision produit : toujours proposé, jamais obligatoire, donc pas de champ
/// requis côté declareSickLeave, un ajout possible ensuite depuis mon-espace. On revient
/// une erreur (pas une redirection) : c'est appelé depuis un formulaire client qui
/// affiche le message lui-même.
export async function uploadCertificate(formData: FormData) {
  const ctx = await getCurrentContext();
  const timeOffRequestId = String(formData.get("timeOffRequestId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File)) throw new Error("Fichier manquant.");
  if (!timeOffRequestId) throw new Error("Demande introuvable.");

  const request = await prisma.timeOffRequest.findFirst({
    where: { id: timeOffRequestId, membershipId: ctx.membership.id, kind: "maladie" },
  });
  if (!request) throw new Error("Demande introuvable.");

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Format non accepté (PDF, JPEG ou PNG uniquement).");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Fichier trop volumineux (5 Mo maximum).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = await saveEmployeeDocument(buffer, file.type);

  await prisma.employeeDocument.create({
    data: {
      membershipId: ctx.membership.id,
      timeOffRequestId,
      label: "Certificat médical",
      fileName,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    },
  });

  revalidateMyPaths();
  revalidatePath("/conges");
}

const ChangeCodeSchema = z
  .object({
    currentCode: z.string().min(1, "Code actuel requis."),
    newCode: z
      .string()
      .regex(/^[A-Za-z0-9]{4,8}$/, "Le nouveau code doit contenir entre 4 et 8 caractères (lettres et chiffres)."),
  });

/// Un employé change son propre code — jamais celui d'un tiers (aucun membershipId en
/// paramètre). Exige l'ancien code : un compte déjà ouvert sur un poste partagé ne doit
/// pas permettre à qui passe devant l'écran de changer le code de quelqu'un d'autre.
export async function changeMyCode(input: z.infer<typeof ChangeCodeSchema>) {
  const ctx = await getCurrentContext();
  const data = ChangeCodeSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!user?.codeHash) throw new Error("Ce compte n'utilise pas de code d'accès.");

  const valid = await bcrypt.compare(data.currentCode, user.codeHash);
  if (!valid) throw new Error("Code actuel incorrect.");

  const codeHash = await bcrypt.hash(data.newCode, 10);
  await prisma.user.update({ where: { id: ctx.user.id }, data: { codeHash } });
}

/// L'horaire habituel (kind="preferred" + serviceId, récurrent) n'est modifiable par
/// l'employé lui-même que pour un statut flexijob — pour un statut fixe, c'est le
/// manager qui le déclare (voir staff/server/actions.ts, setEmployeeUsualAvailability),
/// l'employé ne peut qu'ajouter des disponibilités ponctuelles (voir
/// addMyOneOffAvailability ci-dessous). Chaque modification flexijob notifie qui
/// construit le planning : contrairement à un manager qui décide, ici c'est
/// l'employé qui change ce que le manager doit prendre en compte.
async function requireFlexijob() {
  const ctx = await getCurrentContext();
  if (ctx.membership.employmentType !== "flexijob") {
    throw new Error("Réservé aux comptes flexijob — votre horaire habituel est géré par votre manager.");
  }
  return ctx;
}

export async function setMyUsualAvailability(dayOfWeek: number, serviceId: string, works: boolean) {
  await setMyUsualAvailabilityBulk(dayOfWeek, [serviceId], works);
}

/// "Toute la journée" (voir AvailabilityToggles côté client) coche tous les services
/// d'un jour en un seul aller-retour serveur — plutôt qu'un appel par service, ce qui
/// déclencherait plusieurs Server Actions concurrentes (et donc plusieurs
/// revalidatePath) depuis un seul clic, un scénario qui peut se désynchroniser côté
/// client (déjà rencontré une fois avec l'ancienne version de ce mécanisme).
export async function setMyUsualAvailabilityBulk(dayOfWeek: number, serviceIds: string[], works: boolean) {
  const ctx = await requireFlexijob();
  if (dayOfWeek < 1 || dayOfWeek > 7) throw new Error("Jour invalide.");
  if (serviceIds.length === 0) return;

  const services = await prisma.serviceDefinition.findMany({
    where: { id: { in: serviceIds }, establishmentId: ctx.establishment.id },
  });
  if (services.length !== serviceIds.length) throw new Error("Service introuvable.");

  await prisma.availability.deleteMany({
    where: { membershipId: ctx.membership.id, dayOfWeek, kind: "preferred", serviceId: { in: serviceIds }, date: null },
  });

  if (works) {
    await prisma.availability.createMany({
      data: serviceIds.map((serviceId) => ({
        establishmentId: ctx.establishment.id,
        membershipId: ctx.membership.id,
        dayOfWeek,
        kind: "preferred",
        serviceId,
      })),
    });
  }

  const dayLabel = new Intl.DateTimeFormat("fr-BE", { weekday: "long" }).format(new Date(2024, 0, dayOfWeek));
  const serviceNames = services.map((s) => s.name).join(", ");
  const memberName = `${ctx.user.firstName} ${ctx.user.lastName}`;
  await notifyScheduleEditors(
    ctx.establishment.id,
    ctx.membership.id,
    `${memberName} a modifié son horaire habituel`,
    `${dayLabel} · ${serviceNames} : ${works ? "ajouté" : "retiré"}.`
  );

  revalidatePath("/mon-espace");
  revalidatePath("/planning");
}

const OneOffAvailabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().min(1),
});

/// Disponibilité ajoutée "en plus" par l'employé lui-même (fixe ou flexijob) au-delà
/// de son horaire habituel — jamais une modification de celui-ci, une déclaration
/// ponctuelle pour cette date précise (voir Availability.date). Limitée à la semaine
/// affichée (calendaire, lundi-dimanche) : au-delà, ça devient une modification de
/// l'horaire habituel, réservée au manager (ou au flexijob via setMyUsualAvailability).
export async function addMyOneOffAvailability(input: z.infer<typeof OneOffAvailabilitySchema>): Promise<{ id: string }> {
  const ctx = await getCurrentContext();
  const data = OneOffAvailabilitySchema.parse(input);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const date = new Date(`${data.date}T00:00:00`);
  if (date < weekStart || date > weekEnd) {
    throw new Error("Cette date sort de la semaine en cours.");
  }

  const service = await prisma.serviceDefinition.findFirst({
    where: { id: data.serviceId, establishmentId: ctx.establishment.id },
  });
  if (!service) throw new Error("Service introuvable.");

  const existing = await prisma.availability.findFirst({
    where: { membershipId: ctx.membership.id, date, serviceId: data.serviceId, kind: "preferred" },
  });
  const row =
    existing ??
    (await prisma.availability.create({
      data: {
        establishmentId: ctx.establishment.id,
        membershipId: ctx.membership.id,
        dayOfWeek: isoWeekday(date),
        kind: "preferred",
        serviceId: data.serviceId,
        date,
      },
    }));

  if (!existing) {
    const memberName = `${ctx.user.firstName} ${ctx.user.lastName}`;
    await notifyScheduleEditors(
      ctx.establishment.id,
      ctx.membership.id,
      `${memberName} s'est rendu disponible en plus`,
      `${toDateKey(date)} · ${service.name}.`
    );
  }

  revalidatePath("/mon-espace");
  revalidatePath("/planning");
  return { id: row.id };
}

/// Retrait libre à tout moment — jamais pour un tiers (scope à ctx.membership.id).
export async function removeMyOneOffAvailability(availabilityId: string) {
  const ctx = await getCurrentContext();
  await prisma.availability.deleteMany({
    where: { id: availabilityId, membershipId: ctx.membership.id, date: { not: null } },
  });
  revalidatePath("/mon-espace");
  revalidatePath("/planning");
}

export async function markNotificationRead(notificationId: string) {
  const ctx = await getCurrentContext();
  await prisma.notification.updateMany({
    where: { id: notificationId, membershipId: ctx.membership.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/mon-espace");
}

export async function markAllNotificationsRead() {
  const ctx = await getCurrentContext();
  await prisma.notification.updateMany({
    where: { membershipId: ctx.membership.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/mon-espace");
}

/// Supprime une notification de la personne connectée (jamais celle d'un autre membre).
export async function deleteNotification(notificationId: string) {
  const ctx = await getCurrentContext();
  await prisma.notification.deleteMany({ where: { id: notificationId, membershipId: ctx.membership.id } });
  revalidatePath("/mon-espace");
}

/// Efface toutes les notifications déjà lues ; celles qui n'ont pas été lues restent.
export async function clearReadNotifications() {
  const ctx = await getCurrentContext();
  await prisma.notification.deleteMany({ where: { membershipId: ctx.membership.id, readAt: { not: null } } });
  revalidatePath("/mon-espace");
}
