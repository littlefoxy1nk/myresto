"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { CLOSING_SOURCE } from "@/modules/finance/server/shared";

const ClosingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  revenueCents: z.number().int().min(0),
  covers: z.number().int().min(0),
});

export async function recordDailyClosing(input: z.infer<typeof ClosingSchema>) {
  const ctx = await requirePermission("finance.manage");
  const { date, revenueCents, covers } = ClosingSchema.parse(input);
  const day = startOfDay(new Date(`${date}T00:00:00`));

  const existing = await prisma.revenueEntry.findFirst({
    where: { establishmentId: ctx.establishment.id, date: day, source: CLOSING_SOURCE },
  });

  if (existing) {
    await prisma.revenueEntry.update({
      where: { id: existing.id },
      data: { amountCents: revenueCents, covers },
    });
  } else {
    await prisma.revenueEntry.create({
      data: { establishmentId: ctx.establishment.id, date: day, amountCents: revenueCents, covers, source: CLOSING_SOURCE },
    });
  }

  revalidatePath("/aujourdhui");
  revalidatePath("/finances");
}
