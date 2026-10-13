import { prisma } from "@/lib/prisma";
import { isoWeekday } from "@/lib/time";
import type { ServiceWindow } from "@/modules/service/spans";

/// Les services qui tournent un jour donné (selon leurs jours de la semaine).
export async function getServiceWindowsForDate(establishmentId: string, date: Date): Promise<ServiceWindow[]> {
  const weekday = isoWeekday(date);
  const all = await prisma.serviceDefinition.findMany({ where: { establishmentId }, orderBy: { startTime: "asc" } });
  return all
    .filter((s) => s.daysOfWeek.split(",").map(Number).includes(weekday))
    .map((s) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime }));
}
