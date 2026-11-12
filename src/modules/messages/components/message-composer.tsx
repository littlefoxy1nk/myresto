"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";
import { AUDIENCES, type Audience } from "@/modules/messages/audience";
import { postAnnouncement } from "@/modules/messages/server/actions";

const field =
  "w-full rounded-2xl border border-border bg-card/80 px-4 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

/// Écrire à son équipe : un titre court, un message, et à qui ça s'adresse.
export function MessageComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await postAnnouncement({ title, body, audience });
      if (result.ok) {
        setTitle("");
        setBody("");
        toast(result.sentTo > 0 ? `Message envoyé à ${result.sentTo} personne${result.sentTo > 1 ? "s" : ""}` : "Message publié (personne d'autre dans ce groupe pour l'instant)");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Une erreur est survenue. Réessaie dans un instant.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5 rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <div role="radiogroup" aria-label="À qui s'adresse le message" className="flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={audience === a.key}
            onClick={() => setAudience(a.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              audience === a.key ? "border-transparent bg-ink text-ink-foreground" : "border-border bg-card/60 hover:bg-muted"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="msg-title" className="text-sm font-semibold">
          Titre
        </label>
        <input id="msg-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="ex : Réunion d'équipe lundi 15h" className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="msg-body" className="text-sm font-semibold">
          Message <span className="font-normal text-muted-foreground">(facultatif)</span>
        </label>
        <textarea id="msg-body" value={body} maxLength={1000} rows={3} onChange={(e) => setBody(e.target.value)} className={field} />
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-urgent-soft px-3.5 py-2.5 text-sm font-medium text-urgent">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !title.trim()}>
        <Send size={15} aria-hidden="true" />
        {pending ? "Envoi…" : "Envoyer"}
      </Button>
    </form>
  );
}
