import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import { computeAverageTicket } from "@/modules/finance/compute";

/// Estimation simple du CA prévu du jour, basée sur le panier moyen observé sur les 30
/// derniers jours multiplié par les couverts déjà réservés. Volontairement transparent
/// et vérifiable — pas de prévision "boîte noire".
export async function estimateTodayRevenue(establishmentId: string, coversToday: number) {
  const since = subDays(new Date(), 30);
  const recent = await prisma.revenueEntry.findMany({
    where: { establishmentId, date: { gte: since } },
  });

  const avgTicketCents = computeAverageTicket(recent) ?? 0;

  return {
    avgTicketCents,
    estimatedRevenueCents: avgTicketCents * coversToday,
  };
}
