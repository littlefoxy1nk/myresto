import type { ZoneWithTables } from "@/modules/floorplan/types";

export type ServiceWindow = { name: string; startTime: string; endTime: string } | null;

/// Le plan affiché sur Aujourd'hui : celui du service qui se déroule ("live", états en direct) ou, à défaut,
/// du prochain service du jour ("upcoming", tables prises sur sa plage), sinon rien ("none").
export type TodayServicePlan = {
  mode: "live" | "upcoming" | "none";
  service: { name: string; startTime: string; endTime: string; minutesFromNow: number } | null;
  zones: ZoneWithTables[];
};
