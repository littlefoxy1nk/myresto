"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/lib/toast-bus";
import { createEditorialLine, deleteEditorialLine, updateEditorialLine } from "@/modules/marketing/server/actions";
import type { EditorialLineItem } from "@/modules/marketing/types";

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

const FIELDS: { key: keyof Omit<EditorialLineItem, "id" | "name">; label: string; hint: string; rows: number }[] = [
  { key: "audience", label: "À qui on parle", hint: "ex : les habitués du quartier, les familles du dimanche", rows: 2 },
  { key: "tone", label: "Le ton", hint: "ex : chaleureux, simple, un peu d'humour — on se tutoie", rows: 2 },
  { key: "themes", label: "De quoi on parle", hint: "ex : le plat du jour, les produits de saison, les coulisses, les soirées à thème", rows: 3 },
  { key: "avoid", label: "Ce qu'on évite", hint: "ex : parler prix, les promos à répétition, les fautes d'orthographe", rows: 3 },
  { key: "hashtags", label: "Hashtags et mentions habituels", hint: "ex : #bruxelles #resto @lepetitcomptoir", rows: 2 },
];

/// "Ligne éditoriale" : les règles d'écriture de chaque type de communication. Elles sont rappelées
/// dans « Traitement de sujet » ; rien n'est généré à partir d'elles, c'est la personne qui rédige.
export function EditorialLinesApp({ lines, canManage }: { lines: EditorialLineItem[]; canManage: boolean }) {
  const [editing, setEditing] = useState<EditorialLineItem | "new" | null>(null);
  const [toDelete, setToDelete] = useState<EditorialLineItem | null>(null);

  return (
    <div className="space-y-4">
      {canManage && (
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} aria-hidden="true" />
          Nouvelle ligne éditoriale
        </Button>
      )}

      {lines.length === 0 ? (
        <Card className="space-y-1 p-6 text-center">
          <p className="text-sm font-medium">Aucune ligne éditoriale pour l&apos;instant</p>
          <p className="text-sm text-muted-foreground">
            Une ligne éditoriale, c&apos;est ta façon de parler : à qui, sur quel ton, de quoi, et ce que tu évites. Tu peux en
            avoir plusieurs (Instagram, newsletter…).
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {lines.map((line) => (
            <Card key={line.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold">{line.name}</h2>
                {canManage && (
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(line)} aria-label={`Modifier ${line.name}`}>
                      <Pencil size={14} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:bg-muted"
                      onClick={() => setToDelete(line)}
                      aria-label={`Supprimer ${line.name}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
              <dl className="space-y-2 text-sm">
                {FIELDS.map((f) =>
                  line[f.key] ? (
                    <div key={f.key}>
                      <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
                      <dd className="whitespace-pre-line">{line[f.key]}</dd>
                    </div>
                  ) : null
                )}
              </dl>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <LineDialog key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onOpenChange={(o) => !o && setEditing(null)} />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Supprimer « ${toDelete?.name ?? ""} » ?`}
        description="Les publications qui la suivaient sont conservées, sans cette ligne."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (!toDelete) return;
          deleteEditorialLine(toDelete.id)
            .then(() => toast("Ligne supprimée"))
            .catch((err) => toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error"));
        }}
      />
    </div>
  );
}

function LineDialog({ initial, onOpenChange }: { initial: EditorialLineItem | null; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, initial?.[f.key] ?? ""]))
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogTitle>{initial ? "Modifier la ligne éditoriale" : "Nouvelle ligne éditoriale"}</DialogTitle>
        <DialogDescription>Seul le nom est obligatoire : remplis ce qui t&apos;aide à écrire.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            const input = { name, audience: values.audience, tone: values.tone, themes: values.themes, avoid: values.avoid, hashtags: values.hashtags };
            try {
              if (initial) await updateEditorialLine(initial.id, input);
              else await createEditorialLine(input);
              toast(initial ? "Ligne modifiée" : "Ligne créée");
              onOpenChange(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="line-name" className="text-sm font-medium">
              Nom
            </label>
            <input id="line-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Instagram du restaurant" className={field} />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label htmlFor={`line-${f.key}`} className="text-sm font-medium">
                {f.label}
              </label>
              <textarea
                id={`line-${f.key}`}
                rows={f.rows}
                value={values[f.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.hint}
                className={field}
              />
            </div>
          ))}
          {error && (
            <p className="text-sm text-urgent" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending || !name.trim()}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
