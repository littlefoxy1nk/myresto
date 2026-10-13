"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { format, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/current-context";
import { CLOSING_SOURCE, ClosingSchema, DayFiguresSchema, MonthFigureSchema } from "@/modules/finance/server/shared";

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

function revalidateFinance() {
  revalidatePath("/finances");
  revalidatePath("/aujourdhui");
}

/// Enregistre (ou efface) les chiffres de plusieurs jours : met à jour la clôture du jour déjà
/// saisie, ou la crée. Un jour dont les deux champs sont vides est effacé de la saisie.
export async function saveDayFigures(input: z.infer<typeof DayFiguresSchema>) {
  const ctx = await requirePermission("finance.manage");
  const { entries } = DayFiguresSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    for (const e of entries) {
      const day = startOfDay(new Date(`${e.date}T00:00:00`));
      const existing = await tx.revenueEntry.findFirst({
        where: { establishmentId: ctx.establishment.id, date: day, source: CLOSING_SOURCE },
      });
      const empty = e.revenueCents === null && e.covers === null;

      if (empty) {
        if (existing) await tx.revenueEntry.delete({ where: { id: existing.id } });
      } else if (existing) {
        await tx.revenueEntry.update({
          where: { id: existing.id },
          data: { amountCents: e.revenueCents ?? 0, covers: e.covers ?? 0 },
        });
      } else {
        await tx.revenueEntry.create({
          data: {
            establishmentId: ctx.establishment.id,
            date: day,
            amountCents: e.revenueCents ?? 0,
            covers: e.covers ?? 0,
            source: CLOSING_SOURCE,
          },
        });
      }
    }
  });
  revalidateFinance();
}

/// Enregistre le chiffre d'un mois entier (ou le retire si les deux champs sont vides).
export async function saveMonthFigure(input: z.infer<typeof MonthFigureSchema>) {
  const ctx = await requirePermission("finance.manage");
  const data = MonthFigureSchema.parse(input);
  const where = { establishmentId_year_month: { establishmentId: ctx.establishment.id, year: data.year, month: data.month } };

  if (data.revenueCents === null && data.covers === null) {
    await prisma.monthlyFigure.deleteMany({
      where: { establishmentId: ctx.establishment.id, year: data.year, month: data.month },
    });
  } else {
    await prisma.monthlyFigure.upsert({
      where,
      create: {
        establishmentId: ctx.establishment.id,
        year: data.year,
        month: data.month,
        amountCents: data.revenueCents ?? 0,
        covers: data.covers ?? 0,
      },
      update: { amountCents: data.revenueCents ?? 0, covers: data.covers ?? 0 },
    });
  }
  revalidateFinance();
}

export type MonthFiguresData = {
  days: { date: string; revenueCents: number | null; covers: number | null }[];
  month: { revenueCents: number; covers: number } | null;
};

/// Ce qui est déjà saisi pour un mois, pour préremplir la grille.
export async function getMonthFigures(year: number, month: number): Promise<MonthFiguresData> {
  const ctx = await requirePermission("finance.manage");
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);

  const [entries, monthly] = await Promise.all([
    prisma.revenueEntry.findMany({
      where: { establishmentId: ctx.establishment.id, source: CLOSING_SOURCE, date: { gte: from, lte: to } },
    }),
    prisma.monthlyFigure.findUnique({
      where: { establishmentId_year_month: { establishmentId: ctx.establishment.id, year, month } },
    }),
  ]);

  return {
    days: entries.map((e) => ({ date: format(e.date, "yyyy-MM-dd"), revenueCents: e.amountCents, covers: e.covers })),
    month: monthly ? { revenueCents: monthly.amountCents, covers: monthly.covers } : null,
  };
}
