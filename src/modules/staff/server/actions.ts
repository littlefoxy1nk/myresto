"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";

const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis."),
  lastName: z.string().min(1, "Le nom est requis."),
  email: z.string().email("Adresse email invalide."),
  phone: z.string().optional(),
  roleId: z.string().min(1, "Choisissez un rôle."),
  jobTitle: z.string().optional(),
});

export type CreateEmployeeValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: string;
  jobTitle: string;
  availableDays: string[];
};

export type CreateEmployeeState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof CreateEmployeeValues, string>>;
  values: CreateEmployeeValues;
  attempt: number;
  success?: { name: string; tempPassword: string };
};

// Pas de constante exportée ici au-delà des fonctions : un fichier "use server" ne peut
// exporter que des fonctions async — une constante exportée devient `undefined` côté
// client de façon silencieuse (pas d'erreur de build). Les valeurs par défaut du
// formulaire vivent donc dans le composant client (new-employee-form.tsx).

function valuesFromFormData(formData: FormData): CreateEmployeeValues {
  return {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    roleId: String(formData.get("roleId") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    availableDays: formData.getAll("availableDays").map(String),
  };
}

function generateTempPassword() {
  // Lisible à l'oral pour être communiqué facilement à l'employé (pas de caractères ambigus).
  return crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "9");
}

export async function createEmployee(
  prev: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const ctx = await requirePermission("staff.manage");
  const values = valuesFromFormData(formData);
  const attempt = prev.attempt + 1;

  const parsed = CreateEmployeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: CreateEmployeeState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof CreateEmployeeValues;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Merci de corriger les champs indiqués ci-dessous.", fieldErrors, values, attempt };
  }
  const data = parsed.data;

  const role = await prisma.role.findFirst({
    where: { id: data.roleId, establishmentId: ctx.establishment.id },
  });
  if (!role) {
    return {
      error: "Rôle invalide.",
      fieldErrors: { roleId: "Choisissez un rôle valide." },
      values,
      attempt,
    };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    return {
      error: "Un compte existe déjà avec cet email.",
      fieldErrors: { email: "Cette adresse est déjà utilisée." },
      values,
      attempt,
    };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const user = await prisma.user.create({
    data: {
      companyId: ctx.establishment.companyId,
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
    },
  });

  await prisma.membership.create({
    data: {
      userId: user.id,
      establishmentId: ctx.establishment.id,
      roleId: role.id,
      jobTitle: data.jobTitle || null,
      hiredAt: new Date(),
    },
  });

  const membership = await prisma.membership.findUniqueOrThrow({
    where: { userId_establishmentId: { userId: user.id, establishmentId: ctx.establishment.id } },
  });

  const days = values.availableDays.map(Number).filter((d) => d >= 1 && d <= 7);
  if (days.length > 0) {
    await prisma.availability.createMany({
      data: days.map((dayOfWeek) => ({
        establishmentId: ctx.establishment.id,
        membershipId: membership.id,
        dayOfWeek,
        kind: "preferred",
      })),
    });
  }

  revalidatePath("/equipe");

  return {
    values: { firstName: "", lastName: "", email: "", phone: "", roleId: "", jobTitle: "", availableDays: [] },
    attempt,
    success: { name: `${data.firstName} ${data.lastName}`, tempPassword },
  };
}
