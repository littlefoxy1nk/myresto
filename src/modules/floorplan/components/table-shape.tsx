"use client";

import { cn } from "@/lib/utils";
import { LIVE_STATE_STYLE } from "@/modules/floorplan/live-state-style";
import type { TableWithLiveState } from "@/modules/floorplan/types";

export function TableShape({
  table,
  selected,
  dragging,
  onPointerDownCapture,
}: {
  table: TableWithLiveState;
  selected: boolean;
  dragging: boolean;
  onPointerDownCapture?: (e: React.PointerEvent) => void;
}) {
  const style = LIVE_STATE_STYLE[table.liveState];

  return (
    <div
      onPointerDownCapture={onPointerDownCapture}
      className={cn(
        "absolute flex select-none flex-col items-center justify-center border-2 text-xs font-medium shadow-sm transition-shadow",
        table.shape === "round" ? "rounded-full" : "rounded-lg",
        style.fill,
        style.border,
        style.text,
        selected && "ring-2 ring-accent ring-offset-2 ring-offset-background",
        dragging ? "cursor-grabbing shadow-lg" : "cursor-grab"
      )}
      style={{ left: table.posX, top: table.posY, width: table.width, height: table.height }}
      data-table-id={table.id}
    >
      <span className="text-sm font-semibold">{table.label}</span>
      <span className="opacity-80">{table.capacity} pers.</span>
    </div>
  );
}
