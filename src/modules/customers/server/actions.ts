"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";

const UpdateProfileSchema = z.object({
  preferences: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
  favoriteTableId: z.string().optional(),
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
    },
  });

  revalidatePath(`/clients/${customerId}`);
}
