"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";
import { createService, deleteService, updateService } from "@/modules/service/server/settings-actions";

export type ServiceRow = { id: string; name: string; startTime: string; endTime: string; days: number[] };

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

function daysLabel(days: number[]) {
  if (days.length === 7) return "Tous les jours";
  return days.map((d) => DAY_LABELS[d - 1]).join(" ");
}

export function ServicesCard({ services }: { services: ServiceRow[] }) {
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  const [toDelete, setToDelete] = useState<ServiceRow | null>(null);

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {services.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {daysLabel(s.days)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(s)} aria-label={`Modifier ${s.name}`}>
                <Pencil size={14} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-muted"
                onClick={() => setToDelete(s)}
                aria-label={`Supprimer ${s.name}`}
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
        <Plus size={14} aria-hidden="true" />
        Ajouter un service
      </Button>

      {editing && (
        <ServiceDialog
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Supprimer « ${toDelete?.name ?? ""} » ?`}
        description="Possible seulement si aucun horaire, besoin ou réservation n'y est rattaché."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteService(toDelete.id);
            toast("Service supprimé");
          } catch (err) {
            toast(err instanceof Error ? err.message : "Impossible de supprimer.", "error");
          }
        }}
      />
    </div>
  );
}

function ServiceDialog({ initial, onOpenChange }: { initial: ServiceRow | null; onOpenChange: (open: boolean) => void }) {
  const [startTime, setStartTime] = useState(initial?.startTime ?? "18:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "20:30");
  const [days, setDays] = useState<number[]>(initial?.days ?? ALL_DAYS);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const field =
    "w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{initial ? "Modifier le service" : "Nouveau service"}</DialogTitle>
        <DialogDescription>
          Un service = une plage d&apos;accueil (ex : de midi à 15h, de 18h à 20h30, de 20h30 à 22h). Il s&apos;appelle par son
          horaire. Deux services ne se chevauchent pas le même jour.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            try {
              const input = { startTime, endTime, days };
              if (initial) await updateService(initial.id, input);
              else await createService(input);
              toast(initial ? "Service modifié" : "Service ajouté");
              onOpenChange(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="svc-start" className="text-sm font-medium">
                Début
              </label>
              <input id="svc-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={field} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="svc-end" className="text-sm font-medium">
                Fin
              </label>
              <input id="svc-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={field} />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Jours</span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days.includes(d)}
                  onClick={() => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                    days.includes(d) ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                  )}
                >
                  {DAY_LABELS[d - 1]}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p className="text-sm text-urgent" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
