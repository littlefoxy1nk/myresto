"use client";

import { useState, useTransition } from "react";
import { Plus, X, StickyNote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { createPlanningNote, deletePlanningNote } from "@/modules/planning/server/actions";
import type { PlanningNoteItem } from "@/modules/planning/types";

/// Rappels du manager sur la semaine ("Jeudi 14h30 : entretien des fûts") — la seule
/// information "à savoir" que la vue simplifiée employé (worker-planning-view.tsx)
/// affiche en plus de l'horaire brut, volontairement sans les alertes RH/conflits.
export function PlanningNotes({ notes, canEdit }: { notes: PlanningNoteItem[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [, startDeleteTransition] = useTransition();

  function submit() {
    if (!date || !message.trim()) return;
    startTransition(async () => {
      try {
        await createPlanningNote({ date, time: time || undefined, message: message.trim() });
        setDate("");
        setTime("");
        setMessage("");
        setOpen(false);
        toast("Note ajoutée");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  function remove(id: string) {
    startDeleteTransition(async () => {
      try {
        await deletePlanningNote(id);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  if (notes.length === 0 && !canEdit) return null;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <StickyNote size={15} aria-hidden="true" />À savoir
        </h2>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
            <Plus size={14} aria-hidden="true" />
            Ajouter
          </Button>
        )}
      </div>

      {open && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-muted p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Heure (optionnel)</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="min-w-[180px] flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="ex : entretien des fûts"
              maxLength={200}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <Button size="sm" disabled={pending || !date || !message.trim()} onClick={submit}>
            {pending ? "…" : "Ajouter"}
          </Button>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune note pour cette semaine.</p>
      ) : (
        <div className="space-y-1.5">
          {notes.map((note) => (
            <div key={note.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <span>
                <span className="font-medium">
                  {note.dateLabel}
                  {note.time ? ` ${note.time}` : ""}
                </span>{" "}
                — {note.message}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(note.id)}
                  aria-label="Supprimer cette note"
                  className="shrink-0 text-muted-foreground outline-none transition-colors hover:text-urgent focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
