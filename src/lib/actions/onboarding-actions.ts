"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { provisionSystemRoles } from "@/lib/provision-establishment";
import { serviceLabel } from "@/lib/service-label";

const OnboardingSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis."),
  lastName: z.string().min(1, "Le nom est requis."),
  email: z.string().email("Adresse email invalide."),
  password: z.string().min(8, "8 caractères minimum."),
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

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return {
      error: "Un compte existe déjà avec cet email.",
      fieldErrors: { email: "Cette adresse est déjà utilisée." },
      values,
      attempt,
    };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const company = await prisma.company.create({ data: { name: data.establishmentName } });
  const establishment = await prisma.establishment.create({
    data: {
      companyId: company.id,
      name: data.establishmentName,
      type: data.establishmentType,
      onboardedAt: new Date(),
    },
  });

  const roleIdByKey = await provisionSystemRoles(establishment.id);
  const ownerRoleId = roleIdByKey.get("OWNER")!;

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
    },
  });

  await prisma.membership.create({
    data: {
      userId: user.id,
      establishmentId: establishment.id,
      roleId: ownerRoleId,
      jobTitle: "Propriétaire",
    },
  });

  await prisma.serviceDefinition.create({
    data: {
      establishmentId: establishment.id,
      name: serviceLabel(data.openTime, data.closeTime),
      startTime: data.openTime,
      endTime: data.closeTime,
      daysOfWeek: "1,2,3,4,5,6,7",
    },
  });

  const zone = await prisma.zone.create({
    data: { establishmentId: establishment.id, name: "Salle", sortOrder: 0 },
  });
  const perRow = 5;
  for (let i = 1; i <= data.tableCount; i++) {
    await prisma.restaurantTable.create({
      data: {
        establishmentId: establishment.id,
        zoneId: zone.id,
        label: `T${i}`,
        capacity: 4,
        posX: ((i - 1) % perRow) * 100 + 40,
        posY: Math.floor((i - 1) / perRow) * 100 + 40,
      },
    });
  }

  // Les champs attendus par la connexion sont `identifier` et `secret` (voir lib/auth.ts).
  await signIn("credentials", { identifier: data.email, secret: data.password, redirect: false });
  redirect("/aujourdhui");
}
