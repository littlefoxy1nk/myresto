"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/app-url";
import { getClientIp } from "@/lib/client-ip";
import { validatePassword } from "@/lib/password-policy";
import { createRateLimiter } from "@/lib/rate-limit";
import { readSmtpConfig } from "@/modules/settings/contact";
import { sendMail } from "@/modules/settings/mailer";
import { RESET_TOKEN_TTL_MINUTES, buildResetEmail, hashResetToken, isResetTokenUsable, newResetToken } from "@/modules/settings/password-reset";

const perIp = createRateLimiter("reset-ip", 5, 60 * 60_000);
const perEmail = createRateLimiter("reset-email", 3, 60 * 60_000);

export type ForgotPasswordResult = { ok: true } | { ok: false; error: string };

/// Demande de lien de réinitialisation. La réponse est toujours la même, que l'adresse ait un compte ou non : on ne
/// révèle pas qui est inscrit.
export async function requestPasswordReset(emailInput: string): Promise<ForgotPasswordResult> {
  const email = z.string().trim().toLowerCase().email().safeParse(emailInput);
  if (!email.success) return { ok: false, error: "Adresse email invalide." };

  if (!(await perIp.allow(await getClientIp())) || !(await perEmail.allow(email.data))) {
    return { ok: false, error: "Trop de demandes. Réessaie dans une heure." };
  }

  const user = await prisma.user.findFirst({ where: { email: email.data, passwordHash: { not: null } }, select: { id: true, firstName: true } });
  if (!user) return { ok: true };

  const base = appBaseUrl();
  if (!base) {
    console.error("Mot de passe oublié : APP_URL n'est pas configurée, aucun lien envoyé.");
    return { ok: true };
  }

  const { token, tokenHash } = newResetToken();
  // Un seul lien valable à la fois : les précédents sont retirés.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000) },
  });

  const link = `${base}/reinitialiser/${token}`;
  const smtp = readSmtpConfig(process.env);
  if (!smtp) {
    // Sans serveur d'envoi (développement), le lien s'affiche dans la console du serveur — jamais en production.
    if (process.env.NODE_ENV !== "production") console.info(`[mot de passe oublié] lien pour ${email.data} : ${link}`);
    else console.error("Mot de passe oublié : SMTP non configuré, aucun email envoyé.");
    return { ok: true };
  }

  try {
    const mail = buildResetEmail({ firstName: user.firstName, link });
    await sendMail(smtp, { to: email.data, ...mail });
  } catch (error) {
    console.error("Mot de passe oublié : envoi de l'email impossible", error);
  }
  return { ok: true };
}

const ResetSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(1, "Choisis un mot de passe.") });

export type ResetPasswordResult = { ok: false; error: string };

/// Choisir un nouveau mot de passe avec le lien reçu. Le lien ne sert qu'une fois ; toutes les sessions ouvertes sont
/// déconnectées et le verrouillage éventuel est levé.
export async function resetPassword(input: z.infer<typeof ResetSchema>): Promise<ResetPasswordResult> {
  const parsed = ResetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ce lien n'est pas valide." };
  if (!(await perIp.allow(`use:${await getClientIp()}`))) return { ok: false, error: "Trop de tentatives. Réessaie dans une heure." };

  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(parsed.data.token) }, include: { user: true } });
  if (!row || !isResetTokenUsable(row, new Date())) return { ok: false, error: "Ce lien a expiré ou a déjà servi. Refais une demande." };

  const problem = validatePassword(parsed.data.password, { email: row.user.email ?? undefined });
  if (problem) return { ok: false, error: problem };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ]);

  redirect("/login?reset=1");
}
