"use client";

import { cn } from "@/lib/utils";
import type { ZoneWithTables } from "@/modules/floorplan/types";
import { Plus, X } from "lucide-react";

const ZONE_ICON: Record<string, string> = {
  salle: "🍽️",
  terrasse: "🌿",
  bar: "🍸",
  prive: "🔒",
  autre: "📍",
};

export function ZoneTabs({
  zones,
  activeZoneId,
  canEdit,
  onSelect,
  onCreateZone,
  onDeleteZone,
}: {
  zones: ZoneWithTables[];
  activeZoneId: string | null;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onCreateZone: () => void;
  onDeleteZone: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {zones.map((zone) => {
        const active = zone.id === activeZoneId;
        const capacity = zone.tables.reduce((s, t) => s + t.capacity, 0);
        const free = zone.tables.filter((t) => t.liveState === "available").length;
        return (
          <div
            key={zone.id}
            className={cn(
              "flex items-center gap-2 rounded-xl border pl-3.5 pr-2 py-2 text-sm font-medium transition-colors",
              active ? "border-accent bg-accent-soft text-accent" : "border-border bg-card text-foreground"
            )}
          >
            <button
              onClick={() => onSelect(zone.id)}
              className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span aria-hidden="true">{ZONE_ICON[zone.type] ?? "📍"}</span>
              {zone.name}
              <span className="text-xs text-muted-foreground">
                {free}/{zone.tables.length} libres · {capacity} pl.
              </span>
            </button>
            {canEdit && active && (
              <button
                onClick={() => onDeleteZone(zone.id)}
                aria-label={`Supprimer la zone ${zone.name}`}
                className="rounded-md p-0.5 text-muted-foreground outline-none transition-colors hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        );
      })}
      {canEdit && (
        <button
          onClick={onCreateZone}
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3.5 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus size={15} aria-hidden="true" />
          Zone
        </button>
      )}
    </div>
  );
}
