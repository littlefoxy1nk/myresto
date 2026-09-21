"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { baseUsername } from "@/modules/staff/username";
import { resolveAndAssignRole } from "@/modules/staff/server/roles";
import type { PermissionKey } from "@/lib/permissions";

const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis."),
  lastName: z.string().min(1, "Le nom est requis."),
  email: z.string().email("Adresse email invalide.").optional().or(z.literal("")),
  phone: z.string().optional(),
  roleId: z.string().min(1, "Choisissez un rôle."),
  jobTitle: z.string().optional(),
  employmentType: z.enum(["fixe", "flexijob"]).default("fixe"),
});

export type CreateEmployeeValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: string;
  jobTitle: string;
  employmentType: "fixe" | "flexijob";
  usualCells: { dayOfWeek: number; serviceId: string }[];
  skills: string[];
  permissions: string[];
};

export type CreateEmployeeState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof CreateEmployeeValues, string>>;
  values: CreateEmployeeValues;
  attempt: number;
  success?: { name: string; username: string; code: string };
};

// Pas de constante exportée ici au-delà des fonctions : un fichier "use server" ne peut
// exporter que des fonctions async — une constante exportée devient `undefined` côté
// client de façon silencieuse (pas d'erreur de build). Les valeurs par défaut du
// formulaire vivent donc dans le composant client (new-employee-form.tsx).

function parseCellKeys(raw: string[]): { dayOfWeek: number; serviceId: string }[] {
  return raw.flatMap((key) => {
    const [dayPart, serviceId] = key.split(":");
    const dayOfWeek = Number(dayPart);
    if (!serviceId || !(dayOfWeek >= 1 && dayOfWeek <= 7)) return [];
    return [{ dayOfWeek, serviceId }];
  });
}

function valuesFromFormData(formData: FormData): CreateEmployeeValues {
  const employmentType = formData.get("employmentType") === "flexijob" ? "flexijob" : "fixe";
  return {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    roleId: String(formData.get("roleId") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    employmentType,
    usualCells: parseCellKeys(formData.getAll("usualCells").map(String)),
    skills: formData.getAll("skills").map(String),
    permissions: formData.getAll("permissions").map(String),
  };
}

/// L'identité RH (prénom/nom) est distincte du moyen de connexion — voir le
/// commentaire sur User dans schema.prisma. Un employé n'a pas besoin d'une adresse
/// email pour recevoir un accès : on lui génère un identifiant lisible ("chloe.dupont")
/// à partir de son nom, avec un suffixe numérique en cas de doublon dans l'entreprise.
async function generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
  const base = baseUsername(firstName, lastName);
  let candidate = base;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

/// Code numérique à 6 chiffres — assez simple à retaper sur un écran de service, assez
/// long pour ne pas être trivialement deviné. Généré par tirage cryptographique (pas
/// Math.random), jamais stocké en clair (voir codeHash).
function generateAccessCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
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
  const email = data.email || null;

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

  // L'horaire habituel N'EST optionnel que pour un statut flexijob (la personne le
  // déclare elle-même ensuite, voir myspace/server/actions.ts) — pour un statut fixe,
  // c'est le seul endroit où le manager le renseigne, donc on ne crée jamais une fiche
  // "fixe" avec un horaire vide (déjà bloqué côté client, revalidé ici).
  if (data.employmentType === "fixe" && values.usualCells.length === 0) {
    return {
      error: "Renseignez l'horaire habituel — requis sauf pour un statut flexijob.",
      values,
      attempt,
    };
  }

  const validCells =
    values.usualCells.length > 0
      ? await (async () => {
          const serviceIds = [...new Set(values.usualCells.map((c) => c.serviceId))];
          const services = await prisma.serviceDefinition.findMany({
            where: { id: { in: serviceIds }, establishmentId: ctx.establishment.id },
          });
          const validServiceIds = new Set(services.map((s) => s.id));
          return values.usualCells.filter((c) => validServiceIds.has(c.serviceId));
        })()
      : [];

  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return {
        error: "Un compte existe déjà avec cet email.",
        fieldErrors: { email: "Cette adresse est déjà utilisée." },
        values,
        attempt,
      };
    }
  }

  const username = await generateUniqueUsername(data.firstName, data.lastName);
  const code = generateAccessCode();
  const codeHash = await bcrypt.hash(code, 10);

  const user = await prisma.user.create({
    data: {
      companyId: ctx.establishment.companyId,
      email,
      username,
      codeHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
    },
  });

  const validSkills = values.skills.filter((s) => ["salle", "bar", "cuisine", "plonge"].includes(s));

  await prisma.membership.create({
    data: {
      userId: user.id,
      establishmentId: ctx.establishment.id,
      roleId: role.id,
      jobTitle: data.jobTitle || null,
      hiredAt: new Date(),
      employmentType: data.employmentType,
      skills: validSkills.length > 0 ? validSkills.join(",") : null,
    },
  });

  const membership = await prisma.membership.findUniqueOrThrow({
    where: { userId_establishmentId: { userId: user.id, establishmentId: ctx.establishment.id } },
  });

  // Droits personnalisés (façon iOS) : si la liste cochée diffère des droits par défaut
  // du rôle choisi, on bascule sur un rôle personnalisé qui porte exactement ces droits
  // — voir resolveAndAssignRole. Rien à faire si la liste n'a pas été touchée.
  if (values.permissions.length > 0) {
    await resolveAndAssignRole(ctx.establishment.id, membership.id, role.id, values.permissions as PermissionKey[]);
  }

  if (validCells.length > 0) {
    await prisma.availability.createMany({
      data: validCells.map(({ dayOfWeek, serviceId }) => ({
        establishmentId: ctx.establishment.id,
        membershipId: membership.id,
        dayOfWeek,
        kind: "preferred",
        serviceId,
      })),
    });
  }

  revalidatePath("/equipe");

  return {
    values: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      roleId: "",
      jobTitle: "",
      employmentType: "fixe",
      usualCells: [],
      skills: [],
      permissions: [],
    },
    attempt,
    success: { name: `${data.firstName} ${data.lastName}`, username, code },
  };
}

export type RegenerateCodeResult = { error: string } | { code: string };

/// Le seul moyen de débloquer un employé verrouillé (voir auth.ts) est de lui régénérer
/// un code : ça remplace le secret ET remet le compteur d'essais à zéro, comme à la
/// création du compte. On ne réutilise pas l'ancien code même s'il n'a pas expiré — un
/// employé qui demande un nouveau code a souvent oublié ou perdu l'ancien.
export async function regenerateEmployeeCode(membershipId: string): Promise<RegenerateCodeResult> {
  const ctx = await requirePermission("staff.manage");

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, establishmentId: ctx.establishment.id },
    include: { user: true },
  });
  if (!membership) {
    return { error: "Employé introuvable." };
  }

  const code = generateAccessCode();
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.user.update({
    where: { id: membership.userId },
    data: { codeHash, failedLoginAttempts: 0, lockedUntil: null },
  });

  revalidatePath(`/equipe/${membershipId}`);
  revalidatePath("/equipe");

  return { code };
}

/// fixe | flexijob (voir Membership.employmentType dans schema.prisma) — change qui a
/// le droit d'écrire l'horaire habituel de cette personne : le manager (fixe) ou la
/// personne elle-même (flexijob, voir myspace/server/actions.ts).
export async function setEmployeeEmploymentType(membershipId: string, employmentType: "fixe" | "flexijob") {
  const ctx = await requirePermission("staff.manage");
  const membership = await prisma.membership.findFirst({ where: { id: membershipId, establishmentId: ctx.establishment.id } });
  if (!membership) throw new Error("Employé introuvable.");

  await prisma.membership.update({ where: { id: membershipId }, data: { employmentType } });
  revalidatePath(`/equipe/${membershipId}`);
}

export async function setEmployeeUsualAvailability(membershipId: string, dayOfWeek: number, serviceId: string, works: boolean) {
  await setEmployeeUsualAvailabilityBulk(membershipId, dayOfWeek, [serviceId], works);
}

/// Horaire habituel déclaré par le manager pour un·e employé·e fixe — même mécanisme
/// que setMyUsualAvailabilityBulk côté flexijob (myspace/server/actions.ts), mais
/// gated par staff.manage et un membershipId explicite plutôt que ctx.membership.id.
/// "Toute la journée" en un seul aller-retour serveur pour la même raison qu'ailleurs :
/// éviter plusieurs Server Actions concurrentes depuis un seul clic.
export async function setEmployeeUsualAvailabilityBulk(membershipId: string, dayOfWeek: number, serviceIds: string[], works: boolean) {
  const ctx = await requirePermission("staff.manage");
  if (dayOfWeek < 1 || dayOfWeek > 7) throw new Error("Jour invalide.");
  if (serviceIds.length === 0) return;

  const membership = await prisma.membership.findFirst({ where: { id: membershipId, establishmentId: ctx.establishment.id } });
  if (!membership) throw new Error("Employé introuvable.");

  const services = await prisma.serviceDefinition.findMany({
    where: { id: { in: serviceIds }, establishmentId: ctx.establishment.id },
  });
  if (services.length !== serviceIds.length) throw new Error("Service introuvable.");

  await prisma.availability.deleteMany({
    where: { membershipId, dayOfWeek, kind: "preferred", serviceId: { in: serviceIds }, date: null },
  });

  if (works) {
    await prisma.availability.createMany({
      data: serviceIds.map((serviceId) => ({
        establishmentId: ctx.establishment.id,
        membershipId,
        dayOfWeek,
        kind: "preferred",
        serviceId,
      })),
    });
  }

  revalidatePath(`/equipe/${membershipId}`);
  revalidatePath("/planning");
}

const UpdateEmployeeSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis."),
  lastName: z.string().min(1, "Le nom est requis."),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  weeklyHoursTarget: z.string().optional(),
  roleId: z.string().min(1, "Choisissez un rôle."),
});

/// Seul endroit qui permet de revenir modifier les données d'un employé après sa
/// création : identité, poste, objectif d'heures, compétences, ET les droits d'accès
/// (résolus vers un rôle exact — voir resolveAndAssignRole, qui gère roleId à elle
/// seule). L'horaire habituel se modifie séparément (setEmployeeUsualAvailability).
export async function updateEmployee(
  membershipId: string,
  input: z.infer<typeof UpdateEmployeeSchema>,
  permissionKeys: PermissionKey[],
  skills: string[]
) {
  const ctx = await requirePermission("staff.manage");
  const data = UpdateEmployeeSchema.parse(input);

  const membership = await prisma.membership.findFirst({ where: { id: membershipId, establishmentId: ctx.establishment.id } });
  if (!membership) throw new Error("Employé introuvable.");

  await resolveAndAssignRole(ctx.establishment.id, membershipId, data.roleId, permissionKeys);

  const validSkills = skills.filter((s) => ["salle", "bar", "cuisine", "plonge"].includes(s));
  const weeklyHoursTarget = data.weeklyHoursTarget ? Number.parseFloat(data.weeklyHoursTarget) : null;

  await prisma.user.update({
    where: { id: membership.userId },
    data: { firstName: data.firstName, lastName: data.lastName, phone: data.phone || null },
  });

  await prisma.membership.update({
    where: { id: membershipId },
    data: {
      jobTitle: data.jobTitle || null,
      weeklyHoursTarget: weeklyHoursTarget != null && !Number.isNaN(weeklyHoursTarget) ? weeklyHoursTarget : null,
      skills: validSkills.length > 0 ? validSkills.join(",") : null,
    },
  });

  revalidatePath(`/equipe/${membershipId}`);
  revalidatePath("/equipe");
}

/// "Supprimer" un employé = le retirer de l'équipe active en coupant tout accès
/// immédiatement, sans effacer son historique (shifts, congés, documents) qui reste
/// nécessaire aux rapports RH/finances déjà produits. On ne touche donc jamais à
/// Membership.delete (cascaderait sur Shift, TimeOffRequest, etc. — voir schema.prisma) :
/// on passe status à "inactive" (déjà filtré partout où compte l'équipe active, ex.
/// /equipe et getCurrentContext) ET on vide les identifiants de connexion du User, pour
/// qu'aucune tentative de connexion ne puisse plus jamais aboutir, même avec l'ancien
/// mot de passe/code. getCurrentContext() revérifie status="active" à chaque requête,
/// donc une session déjà ouverte perd l'accès dès la requête suivante.
export async function removeEmployee(membershipId: string) {
  const ctx = await requirePermission("staff.manage");

  if (membershipId === ctx.membership.id) {
    throw new Error("Vous ne pouvez pas vous retirer vous-même de l'équipe.");
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, establishmentId: ctx.establishment.id },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!membership) throw new Error("Employé introuvable.");

  const managesStaff = membership.role.permissions.some((rp) => rp.permission.key === "staff.manage");
  if (managesStaff) {
    const otherManagers = await prisma.membership.count({
      where: {
        establishmentId: ctx.establishment.id,
        status: "active",
        id: { not: membershipId },
        role: { permissions: { some: { permission: { key: "staff.manage" } } } },
      },
    });
    if (otherManagers === 0) {
      throw new Error("Impossible de retirer le dernier compte ayant accès à la gestion de l'équipe.");
    }
  }

  await prisma.$transaction([
    prisma.membership.update({ where: { id: membershipId }, data: { status: "inactive" } }),
    prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash: null, codeHash: null, failedLoginAttempts: 0, lockedUntil: null },
    }),
  ]);

  revalidatePath("/equipe");
  revalidatePath(`/equipe/${membershipId}`);
}
