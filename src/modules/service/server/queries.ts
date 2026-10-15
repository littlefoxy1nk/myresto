import { prisma } from "@/lib/prisma";
import { getCurrentContext, ForbiddenError } from "@/lib/current-context";
import { getFloorPlan, getFloorPlanForDay } from "@/modules/floorplan/server/queries";
import { resolveActiveService } from "@/modules/service/compute";
import { overlayRealTimeStates } from "@/modules/service/overlay";
import type { TodayServicePlan } from "@/modules/service/types";

/// Le plan de toutes les salles pour le service en cours, ou à défaut le prochain du jour. L'état d'une table
/// n'est jamais recalculé ici : getFloorPlan (en direct) et getFloorPlanForDay (sur la plage d'un service)
/// restent les seules sources de vérité. Vérification interne de la permission : jamais dépendre d'un appelant.
export async function getTodayServicePlan(establishmentId: string): Promise<TodayServicePlan> {
  const ctx = await getCurrentContext();
  if (!ctx.can("service.run")) throw new ForbiddenError("service.run");

  const now = new Date();
  const services = await prisma.serviceDefinition.findMany({ where: { establishmentId } });
  const { current, next } = resolveActiveService(
    services.map((s) => ({ name: s.name, startTime: s.startTime, endTime: s.endTime, daysOfWeek: s.daysOfWeek.split(",").map(Number) })),
    now
  );

  if (current) {
    return {
      mode: "live",
      service: { name: current.name, startTime: current.startTime, endTime: current.endTime, minutesFromNow: 0 },
      zones: await getFloorPlan(establishmentId),
    };
  }

  if (next) {
    const definition = services.find((s) => s.name === next.name && s.startTime === next.startTime);
    if (definition) {
      const [day, live] = await Promise.all([
        getFloorPlanForDay(establishmentId, now, definition.id),
        getFloorPlan(establishmentId),
      ]);
      return {
        mode: "upcoming",
        service: { name: next.name, startTime: next.startTime, endTime: next.endTime, minutesFromNow: next.minutesFromNow },
        zones: overlayRealTimeStates(day.zones, live),
      };
    }
  }

  return { mode: "none", service: null, zones: [] };
}
