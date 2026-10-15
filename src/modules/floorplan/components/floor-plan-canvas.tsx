"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { TableShape } from "@/modules/floorplan/components/table-shape";
import type { TableWithLiveState } from "@/modules/floorplan/types";
import { rectsOverlap } from "@/modules/floorplan/compute";
import { cn } from "@/lib/utils";

type DragState = { id: string; startClientX: number; startClientY: number; startPosX: number; startPosY: number; posX: number; posY: number };
type ResizeState = { id: string; startClientX: number; startClientY: number; startWidth: number; startHeight: number; width: number; height: number };

const CANVAS_SIZE = { width: 2400, height: 1600 };
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
}

const FIT_MARGIN = 40;
const FIT_MAX_HEIGHT = 460;

function tablesBounds(tables: TableWithLiveState[], margin = FIT_MARGIN) {
  return {
    x1: Math.max(0, Math.min(...tables.map((t) => t.posX)) - margin),
    y1: Math.max(0, Math.min(...tables.map((t) => t.posY)) - margin),
    x2: Math.max(...tables.map((t) => t.posX + t.width)) + margin,
    y2: Math.max(...tables.map((t) => t.posY + t.height)) + margin,
  };
}

export function FloorPlanCanvas({
  tables,
  canEdit,
  selectedTableId,
  mergeSelection,
  onSelectTable,
  onMoveTable,
  onResizeTable,
  onDropOnTable,
  fit = false,
  showReservations = false,
}: {
  tables: TableWithLiveState[];
  canEdit: boolean;
  selectedTableId: string | null;
  mergeSelection: Set<string>;
  onSelectTable: (id: string) => void;
  onMoveTable: (id: string, posX: number, posY: number) => void;
  onResizeTable: (id: string, width: number, height: number) => void;
  /// Glisser une table sur une autre propose de les fusionner plutôt que de la déplacer
  /// là — voir computeDropTarget ci-dessous. Optionnel : sans ce prop, un dépôt sur une
  /// autre table reste un simple déplacement (comportement d'avant).
  onDropOnTable?: (draggedId: string, targetId: string) => void;
  /// Mode lecture "tout d'un coup d'œil" (Mode Service) : le plan est cadré sur ses tables
  /// et mis à l'échelle de la largeur disponible — pas de défilement, pas de boutons de zoom.
  fit?: boolean;
  showReservations?: boolean;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const movedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [manualZoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const zoom = fit ? fitZoom : manualZoom;
  const bounds = tables.length > 0 ? tablesBounds(tables) : { x1: 0, y1: 0, x2: CANVAS_SIZE.width, y2: CANVAS_SIZE.height };

  const fitWidth = bounds.x2 - bounds.x1;
  const fitHeight = bounds.y2 - bounds.y1;
  useEffect(() => {
    const el = scrollRef.current;
    if (!fit || !el) return;
    const update = () =>
      setFitZoom(Math.min(1, Math.max(ZOOM_MIN, Math.min(el.clientWidth / fitWidth, FIT_MAX_HEIGHT / fitHeight))));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit, fitWidth, fitHeight]);

  // Cadre toutes les tables de la zone d'un coup : zoom calculé sur leur boîte englobante,
  // puis défilement pour que son coin haut-gauche soit en haut-gauche de la vue.
  function fitToTables() {
    const el = scrollRef.current;
    if (!el || tables.length === 0) return;
    const { x1, y1, x2, y2 } = tablesBounds(tables);
    const next = Math.min(1, clampZoom(Math.min(el.clientWidth / (x2 - x1), el.clientHeight / (y2 - y1))));
    setZoom(next);
    requestAnimationFrame(() => el.scrollTo({ left: x1 * next, top: y1 * next }));
  }

  // Pincement au trackpad / Ctrl+molette : le navigateur envoie un wheel avec ctrlKey.
  // Écouteur natif non passif, sinon la page entière zoomerait à la place du plan.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || fit) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z - e.deltaY * 0.005));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fit]);

  // Une table qu'on dépose sur une autre déjà dans le MÊME groupe n'a rien à fusionner
  // (c'est déjà fait) — dans ce cas on laisse juste le déplacement se produire.
  function findDropTarget(draggedId: string, posX: number, posY: number): TableWithLiveState | null {
    const draggedTable = tables.find((t) => t.id === draggedId);
    if (!draggedTable) return null;
    const draggedGroupId = draggedTable.group?.id ?? null;
    const draggedRect = { x: posX, y: posY, width: draggedTable.width, height: draggedTable.height };
    for (const t of tables) {
      if (t.id === draggedId) continue;
      if (draggedGroupId && t.group?.id === draggedGroupId) continue;
      if (rectsOverlap(draggedRect, { x: t.posX, y: t.posY, width: t.width, height: t.height })) return t;
    }
    return null;
  }

  function startDrag(e: React.PointerEvent, table: TableWithLiveState) {
    if (!canEdit) {
      onSelectTable(table.id);
      return;
    }
    movedRef.current = false;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // Certains navigateurs/scénarios multi-touch peuvent refuser la capture ;
      // le drag reste fonctionnel via les écouteurs pointermove/pointerup normaux.
    }
    setDrag({
      id: table.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosX: table.posX,
      startPosY: table.posY,
      posX: table.posX,
      posY: table.posY,
    });
  }

  function startResize(e: React.PointerEvent, table: TableWithLiveState) {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // Voir startDrag — la capture est un confort, pas une dépendance dure.
    }
    setResize({
      id: table.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWidth: table.width,
      startHeight: table.height,
      width: table.width,
      height: table.height,
    });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (drag) {
      const dx = (e.clientX - drag.startClientX) / zoom;
      const dy = (e.clientY - drag.startClientY) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
      const posX = clamp(drag.startPosX + dx, 0, CANVAS_SIZE.width - 60);
      const posY = clamp(drag.startPosY + dy, 0, CANVAS_SIZE.height - 60);
      setDrag({ ...drag, posX, posY });
      setDropTargetId(onDropOnTable && movedRef.current ? (findDropTarget(drag.id, posX, posY)?.id ?? null) : null);
    } else if (resize) {
      const dx = (e.clientX - resize.startClientX) / zoom;
      const dy = (e.clientY - resize.startClientY) / zoom;
      const width = clamp(resize.startWidth + dx, 48, 240);
      const height = clamp(resize.startHeight + dy, 48, 240);
      setResize({ ...resize, width, height });
    }
  }

  function handlePointerUp() {
    if (drag) {
      const target = movedRef.current && onDropOnTable ? findDropTarget(drag.id, drag.posX, drag.posY) : null;
      if (target && onDropOnTable) onDropOnTable(drag.id, target.id);
      else if (movedRef.current) onMoveTable(drag.id, Math.round(drag.posX), Math.round(drag.posY));
      else onSelectTable(drag.id);
      setDrag(null);
      setDropTargetId(null);
    }
    if (resize) {
      onResizeTable(resize.id, Math.round(resize.width), Math.round(resize.height));
      setResize(null);
    }
  }

  // Enveloppe visuelle derrière les tables d'un même groupe actif, pour rendre la
  // fusion lisible d'un coup d'œil sans avoir à cliquer sur chaque table.
  const groupBounds = new Map<string, { x1: number; y1: number; x2: number; y2: number; label: string }>();
  for (const t of tables) {
    if (!t.group) continue;
    const pos = t.id === drag?.id ? { posX: drag.posX, posY: drag.posY } : { posX: t.posX, posY: t.posY };
    const size = t.id === resize?.id ? { width: resize.width, height: resize.height } : { width: t.width, height: t.height };
    const existing = groupBounds.get(t.group.id);
    const x1 = pos.posX - 10;
    const y1 = pos.posY - 10;
    const x2 = pos.posX + size.width + 10;
    const y2 = pos.posY + size.height + 10;
    const label = t.group.label ?? `Groupe · ${t.group.combinedCapacity}`;
    groupBounds.set(t.group.id, existing
      ? { x1: Math.min(existing.x1, x1), y1: Math.min(existing.y1, y1), x2: Math.max(existing.x2, x2), y2: Math.max(existing.y2, y2), label }
      : { x1, y1, x2, y2, label });
  }

  return (
    <div className="relative rounded-3xl border border-border/70 bg-muted/50">
      {!fit && <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={fitToTables}
          disabled={tables.length === 0}
          aria-label="Voir toutes les tables"
          title="Voir toutes les tables"
          className="flex h-8 w-8 items-center justify-center rounded-lg outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
        >
          <Maximize size={15} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setZoom(clampZoom(zoom - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN} aria-label="Dézoomer" className="flex h-8 w-8 items-center justify-center rounded-lg outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40">
          <Minus size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          aria-label="Revenir à 100 %"
          className="h-8 min-w-12 rounded-lg px-1 text-xs font-medium tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
        >
          {Math.round(zoom * 100)} %
        </button>
        <button type="button" onClick={() => setZoom(clampZoom(zoom + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX} aria-label="Zoomer" className="flex h-8 w-8 items-center justify-center rounded-lg outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40">
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>}
      <div ref={scrollRef} className={fit ? "overflow-hidden rounded-3xl" : "h-[70vh] min-h-[420px] overflow-auto rounded-3xl"}>
        <div
          style={
            fit
              ? { width: fitWidth * zoom, height: fitHeight * zoom, overflow: "hidden", position: "relative", margin: "0 auto" }
              : { width: CANVAS_SIZE.width * zoom, height: CANVAS_SIZE.height * zoom }
          }
        >
      <div
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative origin-top-left"
        style={{
          width: CANVAS_SIZE.width,
          height: CANVAS_SIZE.height,
          transform: fit ? `translate(${-bounds.x1 * zoom}px, ${-bounds.y1 * zoom}px) scale(${zoom})` : `scale(${zoom})`,
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {[...groupBounds.entries()].map(([id, b]) => (
          <div
            key={id}
            className="absolute rounded-xl border border-dashed border-accent/40 bg-accent-soft/30"
            style={{ left: b.x1, top: b.y1, width: b.x2 - b.x1, height: b.y2 - b.y1 }}
          >
            <span className="absolute -top-3 left-2 rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-accent shadow-sm">
              {b.label}
            </span>
          </div>
        ))}

        {tables.map((t) => {
          const isDragging = drag?.id === t.id;
          const isResizing = resize?.id === t.id;
          const displayTable = {
            ...t,
            posX: isDragging ? drag!.posX : t.posX,
            posY: isDragging ? drag!.posY : t.posY,
            width: isResizing ? resize!.width : t.width,
            height: isResizing ? resize!.height : t.height,
          };
          const selected = selectedTableId === t.id || mergeSelection.has(t.id);

          return (
            <div key={t.id} className="contents">
              <TableShape
                table={displayTable}
                selected={selected}
                dragging={isDragging}
                mergeTarget={dropTargetId === t.id}
                showReservation={showReservations}
                onPointerDownCapture={(e) => startDrag(e, t)}
              />
              {canEdit && selected && !isDragging && (
                <div
                  onPointerDown={(e) => startResize(e, t)}
                  className={cn(
                    "absolute h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-accent bg-card shadow"
                  )}
                  style={{
                    left: displayTable.posX + displayTable.width - 7,
                    top: displayTable.posY + displayTable.height - 7,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
