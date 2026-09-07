"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZONE_TYPES, type ZoneType } from "@/modules/floorplan/types";

const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  salle: "Salle",
  terrasse: "Terrasse",
  bar: "Bar",
  prive: "Privé",
  autre: "Autre",
};

export function CreateZoneDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, type: ZoneType) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ZoneType>("salle");
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setName("");
          setType("salle");
        }
      }}
    >
      <DialogContent>
        <DialogTitle>Nouvelle zone</DialogTitle>
        <DialogDescription>Une zone regroupe des tables : salle, terrasse, bar...</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setPending(true);
            await onCreate(name.trim(), type);
            setPending(false);
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="zone-name" className="text-sm font-medium">
              Nom
            </label>
            <input
              id="zone-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Terrasse arrière"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="zone-type" className="text-sm font-medium">
              Type
            </label>
            <select
              id="zone-type"
              value={type}
              onChange={(e) => setType(e.target.value as ZoneType)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {ZONE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ZONE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={pending || !name.trim()}>
            {pending ? "Création…" : "Créer la zone"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
