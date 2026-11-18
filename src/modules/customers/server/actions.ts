"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { audit } from "@/lib/audit";
import { createCustomerByHand, saveCustomerFromReservation } from "@/modules/customers/server/save";
import { eraseAllCustomers } from "@/modules/customers/server/erase";
import { normalizePhone } from "@/modules/messaging/phone";

const UpdateProfileSchema = z.object({
  preferences: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
  favoriteTableId: z.string().optional(),
  phone: z.string().optional(),
  /// yyyy-MM-dd, ou vide pour l'effacer.
  birthday: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date d'anniversaire invalide.").optional(),
});

export async function updateCustomerProfile(customerId: string, input: z.infer<typeof UpdateProfileSchema>) {
  const ctx = await requirePermission("crm.manage");
  const data = UpdateProfileSchema.parse(input);

  const customer = await prisma.customer.findFirst({ where: { id: customerId, establishmentId: ctx.establishment.id } });
  if (!customer) throw new Error("Client introuvable.");

  if (data.favoriteTableId) {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: data.favoriteTableId, establishmentId: ctx.establishment.id },
    });
    if (!table) throw new Error("Table introuvable.");
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      preferences: data.preferences || null,
      allergies: data.allergies || null,
      notes: data.notes || null,
      favoriteTableId: data.favoriteTableId || null,
      phone: data.phone?.trim() || null,
      birthday: data.birthday ? new Date(`${data.birthday}T00:00:00`) : null,
    },
  });

  revalidatePath(`/clients/${customerId}`);
}

/// Droit à l'effacement : supprime la fiche d'un client. Ses anciennes réservations restent (pour les chiffres du
/// restaurant) mais ne portent plus ni son nom, ni son téléphone, ni son email.
export async function deleteCustomer(customerId: string) {
  const ctx = await requirePermission("crm.manage");
  const customer = await prisma.customer.findFirst({ where: { id: customerId, establishmentId: ctx.establishment.id } });
  if (!customer) throw new Error("Client introuvable.");

  await prisma.$transaction([
    prisma.reservation.updateMany({
      where: { customerId, establishmentId: ctx.establishment.id },
      data: { customerName: "Client supprimé", customerPhone: null, customerEmail: null, customerId: null },
    }),
    prisma.customer.delete({ where: { id: customerId } }),
  ]);
  await audit(ctx, "customer.deleted", "customer", customerId);
  revalidatePath("/clients");
  revalidatePath("/reservations");
}

/// « Enregistrer ce client » : à partir d'une réservation, crée la fiche client (ou retrouve celle qui existe déjà avec ce téléphone
/// ou cet email) et y relie toutes les réservations de cette personne, pour que son historique apparaisse. C'est le restaurateur qui
/// choisit qui entre dans la base clients : plus rien ne s'y ajoute tout seul.
export async function saveReservationAsCustomer(reservationId: string): Promise<{ customerId: string; created: boolean }> {
  const ctx = await requirePermission("crm.manage");
  const result = await saveCustomerFromReservation(ctx.establishment.id, reservationId);
  if (!result) throw new Error("Réservation introuvable.");

  await audit(ctx, "customer.saved", "customer", result.customerId);
  revalidatePath("/clients");
  revalidatePath("/reservations");
  return result;
}

const NewCustomerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Indique un prénom ou un nom.").max(80),
    lastName: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.union([z.literal(""), z.string().trim().max(160).pipe(z.email("Adresse email invalide."))]).optional(),
  })
  .refine((d) => !!d.phone || !!d.email, { message: "Indique au moins un téléphone ou un email." })
  .refine((d) => !d.phone || normalizePhone(d.phone) !== null, { message: "Numéro de téléphone invalide (ex : 0475 12 34 56)." });

/// « Ajouter un client » à la main dans la base clients.
export async function createCustomer(input: z.input<typeof NewCustomerSchema>): Promise<{ customerId: string }> {
  const ctx = await requirePermission("crm.manage");
  const data = NewCustomerSchema.parse(input);
  const result = await createCustomerByHand(ctx.establishment.id, {
    firstName: data.firstName,
    lastName: data.lastName ?? "",
    phone: data.phone || null,
    email: data.email || null,
  });
  await audit(ctx, "customer.created", "customer", result.customerId);
  revalidatePath("/clients");
  revalidatePath("/reservations");
  return result;
}

/// Vide la base clients de CET établissement (voir eraseAllCustomers). Les réservations restent intactes.
export async function deleteAllCustomers(keepNewsletter: boolean): Promise<{ deleted: number; keptSubscribers: number }> {
  const ctx = await requirePermission("crm.manage");
  const result = await eraseAllCustomers(ctx.establishment.id, !!keepNewsletter);
  await audit(ctx, "customer.deleted_all", "establishment", ctx.establishment.id, { ...result, keepNewsletter: !!keepNewsletter });
  revalidatePath("/clients");
  revalidatePath("/reservations");
  return result;
}
