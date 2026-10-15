"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentContext, requirePermission } from "@/lib/current-context";
import { isAvatarConfig } from "@/lib/avatar";
import { MODULES, parseDisabledModules, serializeDisabledModules } from "@/lib/modules";
import { parseMuted, serializeMuted, visibleNotificationCategories } from "@/lib/notification-preferences";
import { createRateLimiter } from "@/modules/booking/logic";
import { sendMail } from "@/modules/settings/mailer";
import {
  ContactSchema,
  DEFAULT_SUPPORT_EMAIL,
  buildSupportEmail,
  readSmtpConfig,
  type ContactInput,
} from "@/modules/settings/contact";

/// Chacun modifie son propre bonhomme — jamais celui d'un autre (aucun identifiant en paramètre).
export async function saveMyAvatar(config: unknown) {
  const ctx = await getCurrentContext();
  if (!isAvatarConfig(config)) throw new Error("Avatar invalide.");
  const { gender, skin, hair, hairStyle, eyes } = config;
  await prisma.user.update({ where: { id: ctx.user.id }, data: { avatarJson: JSON.stringify({ gender, skin, hair, hairStyle, eyes }) } });
  revalidatePath("/", "layout");
}

/// Affiche ou masque une fonctionnalité pour tout l'établissement. Masquer ne supprime rien.
export async function setModuleEnabled(key: string, enabled: boolean) {
  const ctx = await requirePermission("settings.manage");
  if (!MODULES.some((m) => m.key === key)) throw new Error("Fonctionnalité inconnue.");

  const disabled = parseDisabledModules(ctx.establishment.disabledModules);
  if (enabled) disabled.delete(key as never);
  else disabled.add(key as never);

  await prisma.establishment.update({
    where: { id: ctx.establishment.id },
    data: { disabledModules: serializeDisabledModules(disabled) },
  });
  revalidatePath("/", "layout");
}

/// Enregistre les catégories de notifications COUPÉES par la personne. Seules celles que ses droits lui
/// proposent sont prises en compte (on ne peut pas régler ce qu'on ne reçoit pas).
export async function saveMyNotificationPreferences(mutedKeys: string[]) {
  const ctx = await getCurrentContext();
  const allowed = new Set<string>(visibleNotificationCategories(ctx.can).map((c) => c.key));
  const previous = parseMuted(ctx.membership.mutedNotificationCategories);
  // Une catégorie qu'elle ne peut plus voir garde son réglage précédent.
  const next = new Set<string>([...previous].filter((k) => !allowed.has(k)));
  for (const k of mutedKeys) if (allowed.has(k)) next.add(k);

  await prisma.membership.update({
    where: { id: ctx.membership.id },
    data: { mutedNotificationCategories: serializeMuted(next) },
  });
  revalidatePath("/parametres");
}

const perUser = createRateLimiter(5, 3_600_000);

export type ContactResult = { saved: true; emailed: boolean; reason?: "not_configured" | "failed" };

/// Formulaire de contact : le message est TOUJOURS enregistré, puis envoyé par email à l'adresse du
/// support si l'envoi est configuré (SMTP_HOST, SMTP_USER, SMTP_PASS dans l'environnement). Sinon
/// ou en cas d'échec, la personne en est informée au lieu de croire que c'est parti.
export async function sendContactMessage(input: ContactInput): Promise<ContactResult> {
  const ctx = await getCurrentContext();
  const data = ContactSchema.parse(input);
  if (!perUser.allow(ctx.user.id, Date.now())) {
    throw new Error("Tu as déjà envoyé plusieurs messages récemment. Réessaie dans une heure.");
  }

  const userName = `${ctx.user.firstName} ${ctx.user.lastName}`;
  const record = await prisma.contactMessage.create({
    data: {
      establishmentId: ctx.establishment.id,
      userId: ctx.user.id,
      userName,
      userEmail: ctx.user.email,
      category: data.category,
      subject: data.subject,
      message: data.message,
    },
  });

  const smtp = readSmtpConfig(process.env);
  if (!smtp) {
    await prisma.contactMessage.update({ where: { id: record.id }, data: { emailError: "Envoi non configuré" } });
    return { saved: true, emailed: false, reason: "not_configured" };
  }

  const mail = buildSupportEmail({
    category: data.category,
    subject: data.subject,
    message: data.message,
    userName,
    userEmail: ctx.user.email,
    establishmentName: ctx.establishment.name,
    roleLabel: ctx.membership.role.label,
  });

  try {
    await sendMail(smtp, {
      to: process.env.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
      replyTo: ctx.user.email ?? undefined,
      subject: mail.subject,
      text: mail.text,
    });
    await prisma.contactMessage.update({ where: { id: record.id }, data: { emailedAt: new Date(), emailError: null } });
    return { saved: true, emailed: true };
  } catch (err) {
    await prisma.contactMessage.update({
      where: { id: record.id },
      data: { emailError: (err instanceof Error ? err.message : "Erreur d'envoi").slice(0, 300) },
    });
    return { saved: true, emailed: false, reason: "failed" };
  }
}
