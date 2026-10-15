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
  onCreateBulk,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (label: string, capacity: number, shape: TableShape) => Promise<void>;
  onCreateBulk: (count: number, labelPrefix: string, capacity: number, shape: TableShape) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [count, setCount] = useState(1);
  const [capacity, setCapacity] = useState(4);
  const [shape, setShape] = useState<TableShape>("square");
  const [pending, setPending] = useState(false);
  const bulk = count > 1;
  // En mode "plusieurs tables", pas de nom unique possible — un préfixe numéroté à la
  // suite ("T5", "T6"...) remplace le nom libre, modifiable individuellement ensuite
  // comme n'importe quelle table.
  const valid = label.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setLabel("");
          setCount(1);
          setCapacity(4);
          setShape("square");
        }
      }}
    >
      <DialogContent>
        <DialogTitle>Nouvelle{bulk ? "s" : ""} table{bulk ? "s" : ""}</DialogTitle>
        <DialogDescription>
          {bulk
            ? "Créées d'un coup, placées à la suite sur le plan — à renommer ou déplacer individuellement ensuite."
            : "Elle sera ajoutée à la zone actuellement affichée."}
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setPending(true);
            if (bulk) await onCreateBulk(count, label.trim(), capacity, shape);
            else await onCreate(label.trim(), capacity, shape);
            setPending(false);
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="table-count" className="text-sm font-medium">
              Nombre de tables
            </label>
            <input
              id="table-count"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="table-label" className="text-sm font-medium">
                {bulk ? "Préfixe" : "Nom / numéro"}
              </label>
              <input
                id="table-label"
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={bulk ? "ex: T" : "ex: T14"}
                className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
              />
              {bulk && <p className="text-xs text-muted-foreground">Donnera {label || "T"}1, {label || "T"}2…</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="table-capacity" className="text-sm font-medium">
                Capacité {bulk ? "(chacune)" : ""}
              </label>
              <input
                id="table-capacity"
                type="number"
                min={1}
                max={30}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
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
          <Button type="submit" className="w-full" disabled={pending || !valid}>
            {pending ? "Création…" : bulk ? `Créer ${count} tables` : "Créer la table"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
