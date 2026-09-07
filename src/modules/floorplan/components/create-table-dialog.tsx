"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TABLE_SHAPES, type TableShape } from "@/modules/floorplan/types";

const SHAPE_LABELS: Record<TableShape, string> = { square: "Carrée", round: "Ronde", rect: "Rectangulaire" };

export function CreateTableDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (label: string, capacity: number, shape: TableShape) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [shape, setShape] = useState<TableShape>("square");
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setLabel("");
          setCapacity(4);
          setShape("square");
        }
      }}
    >
      <DialogContent>
        <DialogTitle>Nouvelle table</DialogTitle>
        <DialogDescription>Elle sera ajoutée à la zone actuellement affichée.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!label.trim()) return;
            setPending(true);
            await onCreate(label.trim(), capacity, shape);
            setPending(false);
            onOpenChange(false);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="table-label" className="text-sm font-medium">
                Nom / numéro
              </label>
              <input
                id="table-label"
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex: T14"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="table-capacity" className="text-sm font-medium">
                Capacité
              </label>
              <input
                id="table-capacity"
                type="number"
                min={1}
                max={30}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Forme</span>
            <div className="flex gap-2">
              {TABLE_SHAPES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setShape(s)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                    shape === s ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                  }`}
                >
                  {SHAPE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending || !label.trim()}>
            {pending ? "Création…" : "Créer la table"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
