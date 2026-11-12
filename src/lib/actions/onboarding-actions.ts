"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { createEstablishmentWithOwner } from "@/lib/create-establishment";
import { checkAdminSignup, isPlatformAdminEmail } from "@/lib/platform-admin";
import { validatePassword } from "@/lib/password-policy";
import { inviteCodeMatches, signupPolicy } from "@/lib/signup-policy";
import { getClientIp } from "@/lib/client-ip";
import { createRateLimiter } from "@/lib/rate-limit";

const perIp = createRateLimiter("signup", 5, 60 * 60_000);

const OnboardingSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis."),
  lastName: z.string().min(1, "Le nom est requis."),
  email: z.string().trim().toLowerCase().email("Adresse email invalide."),
  password: z.string().min(1, "Choisis un mot de passe."),
  inviteCode: z.string().optional().default(""),
  establishmentName: z.string().min(1, "Le nom de l'établissement est requis."),
  establishmentType: z.enum(["restaurant", "bar", "brasserie", "cafe"]),
  tableCount: z.coerce.number().int().min(1).max(60),
  openTime: z.string().min(1),
  closeTime: z.string().min(1),
});

export type OnboardingValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  inviteCode: string;
  establishmentName: string;
  establishmentType: string;
  tableCount: string;
  openTime: string;
  closeTime: string;
};

export type OnboardingState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof OnboardingValues, string>>;
  values: OnboardingValues;
  attempt: number;
};

// Pas de constante exportée ici au-delà des fonctions : un fichier "use server" ne peut
// exporter que des fonctions async — une constante exportée devient `undefined` côté
// client de façon silencieuse (pas d'erreur de build). L'état initial vit donc dans le
// composant client (page.tsx).

function valuesFromFormData(formData: FormData): OnboardingValues {
  return {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    inviteCode: String(formData.get("inviteCode") ?? ""),
    establishmentName: String(formData.get("establishmentName") ?? ""),
    establishmentType: String(formData.get("establishmentType") ?? "restaurant"),
    tableCount: String(formData.get("tableCount") ?? "12"),
    openTime: String(formData.get("openTime") ?? "12:00"),
    closeTime: String(formData.get("closeTime") ?? "23:00"),
  };
}

export async function createEstablishment(
  prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const values = valuesFromFormData(formData);
  const attempt = prev.attempt + 1;

  const policy = signupPolicy();
  if (!policy.open) {
    return { error: "La création de compte est fermée pour le moment. Contacte MYRESTO pour obtenir une invitation.", values, attempt };
  }
  if (!(await perIp.allow(await getClientIp()))) {
    return { error: "Trop de tentatives. Réessaie dans une heure.", values, attempt };
  }
  // Les adresses de l'équipe MYRESTO ne s'inscrivent qu'avec le code « équipe » (jamais avec celui des restaurateurs).
  const adminProblem = checkAdminSignup({
    email: values.email.trim().toLowerCase(),
    code: values.inviteCode,
    adminCodeMatches: (code) => inviteCodeMatches(code, process.env.ADMIN_INVITE_CODE),
  });
  if (adminProblem) return { error: adminProblem, fieldErrors: { inviteCode: adminProblem }, values, attempt };
  const isTeamEmail = isPlatformAdminEmail(values.email);
  if (!isTeamEmail && policy.requiresCode && !inviteCodeMatches(values.inviteCode, process.env.SIGNUP_INVITE_CODE)) {
    return { error: "Code d'invitation incorrect.", fieldErrors: { inviteCode: "Code d'invitation incorrect." }, values, attempt };
  }

  const parsed = OnboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: OnboardingState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof OnboardingValues;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      error: "Merci de corriger les champs indiqués ci-dessous.",
      fieldErrors,
      values,
      attempt,
    };
  }
  const data = parsed.data;

  const passwordProblem = validatePassword(data.password, { email: data.email, name: data.establishmentName });
  if (passwordProblem) {
    return { error: "Merci de corriger les champs indiqués ci-dessous.", fieldErrors: { password: passwordProblem }, values, attempt };
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return {
      error: "Un compte existe déjà avec cet email.",
      fieldErrors: { email: "Cette adresse est déjà utilisée." },
      values,
      attempt,
    };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  try {
    await createEstablishmentWithOwner({
      establishmentName: data.establishmentName,
      establishmentType: data.establishmentType,
      tableCount: data.tableCount,
      openTime: data.openTime,
      closeTime: data.closeTime,
      owner: { firstName: data.firstName, lastName: data.lastName, email: data.email, passwordHash },
    });
  } catch (error) {
    console.error("Création d'établissement échouée", error);
    return { error: "Une erreur est survenue pendant la création. Réessaie dans un instant.", values, attempt };
  }

  // Les champs attendus par la connexion sont `identifier` et `secret` (voir lib/auth.ts).
  await signIn("credentials", { identifier: data.email, secret: data.password, redirect: false });
  redirect("/aujourdhui");
}
