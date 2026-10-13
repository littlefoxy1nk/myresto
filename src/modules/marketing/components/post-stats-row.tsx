"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { updatePostStats } from "@/modules/marketing/server/actions";

const field =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent";

function toText(v: number | null) {
  return v === null ? "" : String(v);
}

function parse(text: string): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/// Résultats d'une publication, saisis à la main (aucune connexion aux réseaux) : un champ vide = pas renseigné.
export function PostStatsRow({
  postId,
  initial,
  canManage,
}: {
  postId: string;
  initial: { likes: number | null; comments: number | null; reach: number | null };
  canManage: boolean;
}) {
  const [likes, setLikes] = useState(toText(initial.likes));
  const [comments, setComments] = useState(toText(initial.comments));
  const [reach, setReach] = useState(toText(initial.reach));
  const [pending, setPending] = useState(false);

  const changed = likes !== toText(initial.likes) || comments !== toText(initial.comments) || reach !== toText(initial.reach);

  async function save() {
    const l = parse(likes);
    const c = parse(comments);
    const r = parse(reach);
    if (l === undefined || c === undefined || r === undefined) {
      toast("Entre des nombres entiers (ou laisse vide).", "error");
      return;
    }
    setPending(true);
    try {
      await updatePostStats(postId, { likes: l, comments: c, reach: r });
      toast("Résultats enregistrés");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
    } finally {
      setPending(false);
    }
  }

  const inputs: { label: string; value: string; set: (v: string) => void }[] = [
    { label: "J'aime", value: likes, set: setLikes },
    { label: "Commentaires", value: comments, set: setComments },
    { label: "Portée", value: reach, set: setReach },
  ];

  return (
    <div className="flex flex-wrap items-end gap-2">
      {inputs.map((i) => (
        <label key={i.label} className="w-24 space-y-1 text-xs text-muted-foreground">
          {i.label}
          <input inputMode="numeric" value={i.value} disabled={!canManage} onChange={(e) => i.set(e.target.value)} className={field} placeholder="—" />
        </label>
      ))}
      {canManage && changed && (
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "…" : "Enregistrer"}
        </Button>
      )}
    </div>
  );
}
