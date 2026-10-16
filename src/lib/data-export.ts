import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const models = Prisma.dmmf.datamodel.models;

/// Comment retrouver les lignes d'un établissement dans chaque table : directement (colonne establishmentId) ou via la
/// ligne parente qui, elle, en a un (une ligne de réservation → sa réservation → son établissement). Calculé d'après le
/// schéma lui-même, pour qu'un nouveau modèle ne puisse pas être oublié sans qu'on s'en aperçoive.
export function scopeFor(modelName: string, establishmentId: string, depth = 0): Record<string, unknown> | null {
  if (depth > 3) return null;
  const model = models.find((m) => m.name === modelName);
  if (!model) return null;
  if (model.fields.some((f) => f.name === "establishmentId")) return { establishmentId };
  for (const field of model.fields) {
    if (field.kind === "object" && field.relationFromFields?.length && field.isRequired) {
      const parent = scopeFor(field.type, establishmentId, depth + 1);
      if (parent) return { [field.name]: parent };
    }
  }
  return null;
}

/// Les secrets ne sortent jamais d'un export.
const HIDDEN_FIELDS: Record<string, string[]> = { User: ["passwordHash", "codeHash", "failedLoginAttempts", "lockedUntil"] };

type Delegate = { findMany: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown>[]> };

/// Toutes les données d'un établissement, en clair, dans un seul objet (droit à la portabilité).
/// Les photos et documents d'employés sont listés par nom ; leurs fichiers ne sont pas inclus.
export async function exportEstablishmentData(establishmentId: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    note: "Export complet des données de l'établissement. Les mots de passe et codes d'accès n'y figurent jamais.",
  };

  const establishment = await prisma.establishment.findUnique({ where: { id: establishmentId } });
  out.establishment = establishment;

  for (const model of models) {
    if (model.name === "Establishment" || model.name === "Company" || model.name === "Permission") continue;
    const delegate = (prisma as unknown as Record<string, Delegate>)[model.name.charAt(0).toLowerCase() + model.name.slice(1)];
    const where = model.name === "User" ? { memberships: { some: { establishmentId } } } : scopeFor(model.name, establishmentId);
    if (!where) continue;

    const hidden = HIDDEN_FIELDS[model.name] ?? [];
    const rows = await delegate.findMany({ where });
    out[model.name.charAt(0).toLowerCase() + model.name.slice(1)] = rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.includes(key)))
    );
  }
  return out;
}
