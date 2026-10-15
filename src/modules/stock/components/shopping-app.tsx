"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Check, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";
import { listToText, sortItems } from "@/modules/stock/shopping";
import {
  addShoppingItems,
  clearCheckedItems,
  createShoppingList,
  deleteShoppingItem,
  deleteShoppingList,
  renameShoppingList,
  setShoppingItemChecked,
  updateShoppingItem,
} from "@/modules/stock/server/actions";
import type { ShoppingListView } from "@/modules/stock/server/queries";

const inputClass =
  "w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (err) {
    toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
  }
}

export function ShoppingApp({ lists, canEdit }: { lists: ShoppingListView[]; canEdit: boolean }) {
  // Cocher se voit tout de suite, sans attendre le serveur.
  const [optimisticLists, applyToggle] = useOptimistic(lists, (state, t: { itemId: string; checked: boolean }) =>
    state.map((l) => ({ ...l, items: l.items.map((i) => (i.id === t.itemId ? { ...i, checked: t.checked } : i)) }))
  );
  const [, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<ShoppingListView | null>(null);

  function toggle(itemId: string, checked: boolean) {
    startTransition(async () => {
      applyToggle({ itemId, checked });
      await run(() => setShoppingItemChecked(itemId, checked));
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tes listes de courses, par rubrique (fournisseur, commerçant…). Coche ce que tu as acheté.
        </p>
      </div>

      {optimisticLists.length === 0 && (
        <Card className="space-y-3 p-6 text-center">
          <p className="text-sm font-medium">Aucune rubrique pour l&apos;instant</p>
          <p className="text-sm text-muted-foreground">
            Crée une rubrique par endroit où tu fais tes courses (en bas de page), puis note dedans ce qu&apos;il te faut.
          </p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {optimisticLists.map((list) => (
          <ListCard key={list.id} list={list} canEdit={canEdit} onToggle={toggle} onDelete={() => setToDelete(list)} />
        ))}
      </div>

      {canEdit && <NewListForm />}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Supprimer « ${toDelete?.name ?? ""} » ?`}
        description={
          toDelete && toDelete.items.length > 0
            ? toDelete.items.length === 1
              ? "Son article sera supprimé avec elle."
              : `Ses ${toDelete.items.length} articles seront supprimés avec elle.`
            : "Cette rubrique est vide."
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) void run(() => deleteShoppingList(toDelete.id));
        }}
      />
    </div>
  );
}

function ListCard({
  list,
  canEdit,
  onToggle,
  onDelete,
}: {
  list: ShoppingListView;
  canEdit: boolean;
  onToggle: (itemId: string, checked: boolean) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const items = sortItems(list.items);
  const checkedCount = list.items.filter((i) => i.checked).length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(listToText(list.name, list.items));
      toast("Liste copiée");
    } catch {
      toast("Copie impossible : sélectionne le texte à la main.", "error");
    }
  }

  async function saveName() {
    setRenaming(false);
    const clean = name.trim();
    if (!clean || clean === list.name) {
      setName(list.name);
      return;
    }
    await run(() => renameShoppingList(list.id, clean));
  }

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        {renaming ? (
          <input
            autoFocus
            aria-label="Nom de la rubrique"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setName(list.name);
                setRenaming(false);
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        ) : (
          <h2 className="min-w-0 truncate text-base font-semibold">{list.name}</h2>
        )}
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="sm" onClick={copy} aria-label={`Copier ${list.name}`}>
            <Copy size={14} aria-hidden="true" />
          </Button>
          {canEdit && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setRenaming(true)} aria-label={`Renommer ${list.name}`}>
                <Pencil size={14} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-muted"
                onClick={onDelete}
                aria-label={`Supprimer ${list.name}`}
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-0.5">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} canEdit={canEdit} onToggle={onToggle} />
        ))}
        {items.length === 0 && <li className="py-2 text-sm text-muted-foreground">Rien dans cette rubrique.</li>}
      </ul>

      {canEdit && <AddItems listId={list.id} />}

      {canEdit && checkedCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <Button size="sm" variant="secondary" onClick={() => run(() => clearCheckedItems(list.id, "delete"))}>
            Supprimer les cochés ({checkedCount})
          </Button>
          <Button size="sm" variant="ghost" onClick={() => run(() => clearCheckedItems(list.id, "uncheck"))}>
            Tout décocher
          </Button>
        </div>
      )}
    </Card>
  );
}

function ItemRow({
  item,
  canEdit,
  onToggle,
}: {
  item: { id: string; label: string; checked: boolean };
  canEdit: boolean;
  onToggle: (itemId: string, checked: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);

  async function save() {
    setEditing(false);
    const clean = label.trim();
    if (!clean || clean === item.label) {
      setLabel(item.label);
      return;
    }
    await run(() => updateShoppingItem(item.id, clean));
  }

  return (
    <li className="group flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-muted/60">
      <input
        type="checkbox"
        checked={item.checked}
        disabled={!canEdit}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        aria-label={`${item.label} : acheté`}
        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      {editing ? (
        <input
          autoFocus
          aria-label="Modifier l'article"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setLabel(item.label);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-0.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      ) : (
        <span
          onDoubleClick={() => canEdit && setEditing(true)}
          className={cn("min-w-0 flex-1 break-words text-sm", item.checked && "text-muted-foreground line-through")}
        >
          {item.label}
        </span>
      )}
      {canEdit && !editing && (
        <button
          type="button"
          onClick={() => run(() => deleteShoppingItem(item.id))}
          aria-label={`Retirer ${item.label}`}
          className="rounded-md p-1 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-border focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100 max-md:opacity-100"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

/// Ajout en bas de la rubrique : Entrée ajoute, Maj+Entrée fait un retour à la ligne, et coller
/// plusieurs lignes ajoute plusieurs articles d'un coup.
function AddItems({ listId }: { listId: string }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    if (!text.trim() || pending) return;
    setPending(true);
    await run(() => addShoppingItems(listId, text));
    setText("");
    setPending(false);
    ref.current?.focus();
  }

  return (
    <div className="mt-3 flex items-start gap-2">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        aria-label="Ajouter un article"
        placeholder="Ajouter… (ex : 6 kg angus)"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        className={cn(inputClass, "resize-none")}
      />
      <Button size="sm" className="h-9 shrink-0" onClick={submit} disabled={pending || !text.trim()} aria-label="Ajouter">
        <Check size={15} aria-hidden="true" />
      </Button>
    </div>
  );
}

function NewListForm() {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || pending) return;
        setPending(true);
        await run(() => createShoppingList(name));
        setName("");
        setPending(false);
      }}
    >
      <label htmlFor="new-list" className="sr-only">
        Nouvelle rubrique
      </label>
      <input
        id="new-list"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nouvelle rubrique (ex : Boucher)"
        className={cn(inputClass, "min-w-48 flex-1")}
      />
      <Button type="submit" disabled={pending || !name.trim()}>
        <Plus size={15} aria-hidden="true" />
        Ajouter la rubrique
      </Button>
    </form>
  );
}
