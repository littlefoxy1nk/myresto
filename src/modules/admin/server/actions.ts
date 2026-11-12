"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/app-url";
import { audit } from "@/lib/audit";
import { clearAssistanceTarget, ensureSupportMembership, setAssistanceTarget } from "@/lib/assistance";
import { createEstablishmentWithOwner } from "@/lib/create-establishment";
import { readSmtpConfig } from "@/modules/settings/contact";
import { sendMail } from "@/modules/settings/mailer";
import { INVITE_TOKEN_TTL_MINUTES, buildInviteEmail, newResetToken } from "@/modules/settings/password-reset";
import { requirePlatformAdmin } from "@/modules/admin/server/guard";

const CreateSchema = z.object({
  establishmentName: z.string().trim().min(1, "Le nom de l'établissement est requis.").max(80),
  establishmentType: z.enum(["restaurant", "bar", "brasserie", "cafe"]),
  firstName: z.string().trim().min(1, "Le prénom du patron est requis.").max(60),
  lastName: z.string().trim().min(1, "Le nom du patron est requis.").max(60),
  email: z.string().trim().toLowerCase().email("Adresse email invalide."),
  tableCount: z.coerce.number().int().min(1).max(60),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export type InviteResult = {
  establishmentName: string;
  ownerName: string;
  ownerEmail: string;
  /// Le lien à transmettre au patron : il y choisit son mot de passe.
  link: string;
  /// Un email est-il parti tout seul ? (seulement si l'envoi d'emails est configuré)
  emailed: boolean;
};

export type CreateClientState = { error?: string; fieldErrors?: Record<string, string>; created?: InviteResult; attempt: number };

/// Un lien d'invitation valable 7 jours : les précédents du même compte sont retirés (un seul lien valable à la fois).
async function issueInvite(params: { userId: string; firstName: string; email: string; establishmentName: string }): Promise<InviteResult["link"] | null> {
  const base = appBaseUrl();
  if (!base) return null;
  const { token, tokenHash } = newResetToken();
  await prisma.passwordResetToken.deleteMany({ where: { userId: params.userId } });
  await prisma.passwordResetToken.create({
    data: { userId: params.userId, tokenHash, expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MINUTES * 60_000) },
  });
  return `${base}/reinitialiser/${token}`;
}

async function emailInvite(to: string, mail: { subject: string; text: string }): Promise<boolean> {
  const smtp = readSmtpConfig(process.env);
  if (!smtp) return false;
  try {
    await sendMail(smtp, { to, ...mail });
    return true;
  } catch (error) {
    console.error("Invitation : envoi de l'email impossible", error);
    return false;
  }
}

/// Créer l'établissement d'un client : son espace, son patron (sans mot de passe) et un lien pour qu'il choisisse le sien.
export async function createClientEstablishment(prev: CreateClientState, formData: FormData): Promise<CreateClientState> {
  const admin = await requirePlatformAdmin();
  const attempt = prev.attempt + 1;

  const parsed = CreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Merci de corriger les champs indiqués.", fieldErrors, attempt };
  }
  const data = parsed.data;

  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    return { error: "Un compte existe déjà avec cet email.", fieldErrors: { email: "Cette adresse est déjà utilisée." }, attempt };
  }

  let created;
  try {
    created = await createEstablishmentWithOwner({
      establishmentName: data.establishmentName,
      establishmentType: data.establishmentType,
      tableCount: data.tableCount,
      openTime: data.openTime,
      closeTime: data.closeTime,
      owner: { firstName: data.firstName, lastName: data.lastName, email: data.email, passwordHash: null },
    });
  } catch (error) {
    console.error("Création d'établissement (équipe) échouée", error);
    return { error: "La création a échoué. Réessaie dans un instant.", attempt };
  }

  const link = await issueInvite({ userId: created.ownerUserId, firstName: data.firstName, email: data.email, establishmentName: data.establishmentName });
  if (!link) {
    return { error: "L'établissement est créé, mais APP_URL n'est pas configurée : impossible de fabriquer le lien d'invitation.", attempt };
  }
  const emailed = await emailInvite(data.email, buildInviteEmail({ firstName: data.firstName, establishmentName: data.establishmentName, link }));

  await audit({ establishment: { id: created.establishmentId }, user: { id: admin.id } }, "establishment.created_by_team", "establishment", created.establishmentId, {
    ownerEmail: data.email,
  });
  revalidatePath("/admin");
  return {
    attempt,
    created: { establishmentName: data.establishmentName, ownerName: `${data.firstName} ${data.lastName}`, ownerEmail: data.email, link, emailed },
  };
}

/// Un nouveau lien d'invitation pour un patron qui n'a pas encore choisi son mot de passe (lien perdu ou expiré).
export async function resendOwnerInvite(establishmentId: string): Promise<InviteResult | { error: string }> {
  const admin = await requirePlatformAdmin();
  const owner = await prisma.membership.findFirst({
    where: { establishmentId, role: { key: "OWNER" } },
    include: { user: true, establishment: true },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) return { error: "Propriétaire introuvable." };
  if (owner.user.passwordHash) return { error: "Ce patron a déjà choisi son mot de passe." };
  if (!owner.user.email) return { error: "Ce compte n'a pas d'adresse email." };

  const link = await issueInvite({ userId: owner.userId, firstName: owner.user.firstName, email: owner.user.email, establishmentName: owner.establishment.name });
  if (!link) return { error: "APP_URL n'est pas configurée : impossible de fabriquer le lien." };
  const emailed = await emailInvite(owner.user.email, buildInviteEmail({ firstName: owner.user.firstName, establishmentName: owner.establishment.name, link }));
  await audit({ establishment: { id: establishmentId }, user: { id: admin.id } }, "owner.invite_resent", "membership", owner.id);
  return { establishmentName: owner.establishment.name, ownerName: `${owner.user.firstName} ${owner.user.lastName}`, ownerEmail: owner.user.email, link, emailed };
}

/// Entrer chez un client en mode assistance : accès à tout (sauf ce qui est réservé au propriétaire). Chaque entrée est
/// notée dans le journal de l'établissement.
export async function enterAssistance(establishmentId: string): Promise<void> {
  const admin = await requirePlatformAdmin();
  const establishment = await prisma.establishment.findUnique({ where: { id: establishmentId }, select: { id: true } });
  if (!establishment) throw new Error("Établissement introuvable.");

  await ensureSupportMembership(admin.id, establishment.id);
  await setAssistanceTarget(establishment.id);
  await audit({ establishment: { id: establishment.id }, user: { id: admin.id } }, "assistance.entered", "establishment", establishment.id, {
    by: `${admin.firstName} ${admin.lastName}`,
  });
  redirect("/aujourdhui");
}

export async function leaveAssistance(): Promise<void> {
  await clearAssistanceTarget();
  redirect("/admin");
}
