import { prisma } from "@/lib/prisma";
import { clampRules, type OnlineRules } from "@/modules/booking/rules";

/// Ce que la page publique de réservation a le droit de montrer : le nom de l'établissement
/// et les horaires de ses services. Rien d'autre — jamais de données internes.
export async function getPublicBookingInfo(slug: string) {
  const establishment = await prisma.establishment.findFirst({
    where: { bookingSlug: slug, onlineBookingEnabled: true },
    include: { services: { orderBy: { startTime: "asc" } } },
  });
  if (!establishment) return null;
  return {
    name: establishment.name,
    city: establishment.city,
    rules: clampRules({
      maxPartySize: establishment.onlineMaxPartySize,
      maxDaysAhead: establishment.onlineMaxDaysAhead,
      minLeadMinutes: establishment.onlineMinLeadMinutes,
    }) satisfies OnlineRules,
    services: establishment.services.map((s) => ({
      id: s.id,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      days: s.daysOfWeek.split(",").map(Number),
    })),
  };
}
