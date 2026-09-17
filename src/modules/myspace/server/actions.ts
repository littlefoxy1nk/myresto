"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/current-context";
import { notifyMember } from "@/modules/myspace/server/notify";
import { saveEmployeeDocument, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/employee-document-storage";

function revalidateMyPaths() {
  revalidatePath("/mon-espace");
  revalidatePath("/conges");
  revalidatePath("/planning");
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
    newCode: z.string().regex(/^\d{4,8}$/, "Le nouveau code doit contenir entre 4 et 8 chiffres."),
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

/// Indisponibilité déclarée pour un jour de semaine entier — la même notion que
/// isDayGenerallyUnavailable (planning/compute.ts), pour rester cohérent avec ce que
/// le moteur d'objectifs consomme déjà. Ne gère pas les plages horaires précises
/// ("disponible seulement le soir") : une évolution possible, pas construite ici.
export async function setMyDayUnavailability(dayOfWeek: number, unavailable: boolean) {
  const ctx = await getCurrentContext();
  if (dayOfWeek < 1 || dayOfWeek > 7) throw new Error("Jour invalide.");

  await prisma.availability.deleteMany({
    where: { membershipId: ctx.membership.id, dayOfWeek, kind: "unavailable", startTime: null, endTime: null },
  });

  if (unavailable) {
    await prisma.availability.create({
      data: { establishmentId: ctx.establishment.id, membershipId: ctx.membership.id, dayOfWeek, kind: "unavailable" },
    });
  }

  revalidatePath("/mon-espace");
  revalidatePath("/planning");
}

/// Indisponibilité déclarée pour UN service précis d'un jour de semaine — le mode par
/// défaut dès que l'établissement a configuré des services (voir ServiceDefinition).
export async function setMyServiceUnavailability(dayOfWeek: number, serviceId: string, unavailable: boolean) {
  await setMyServicesUnavailability(dayOfWeek, [serviceId], unavailable);
}

/// "Toute la journée" (voir AvailabilityToggles côté client) coche tous les services
/// d'un jour en un seul aller-retour serveur — plutôt qu'un appel par service, ce qui
/// déclencherait plusieurs Server Actions concurrentes (et donc plusieurs
/// revalidatePath) depuis un seul clic, un scénario qui peut se désynchroniser côté
/// client. Un seul mode de stockage (une ligne par service), jamais un troisième mode.
export async function setMyServicesUnavailability(dayOfWeek: number, serviceIds: string[], unavailable: boolean) {
  const ctx = await getCurrentContext();
  if (dayOfWeek < 1 || dayOfWeek > 7) throw new Error("Jour invalide.");
  if (serviceIds.length === 0) return;

  const services = await prisma.serviceDefinition.findMany({
    where: { id: { in: serviceIds }, establishmentId: ctx.establishment.id },
  });
  if (services.length !== serviceIds.length) throw new Error("Service introuvable.");

  await prisma.availability.deleteMany({
    where: { membershipId: ctx.membership.id, dayOfWeek, kind: "unavailable", serviceId: { in: serviceIds } },
  });

  if (unavailable) {
    await prisma.availability.createMany({
      data: serviceIds.map((serviceId) => ({
        establishmentId: ctx.establishment.id,
        membershipId: ctx.membership.id,
        dayOfWeek,
        kind: "unavailable",
        serviceId,
      })),
    });
  }

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
