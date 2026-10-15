"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTACT_CATEGORIES, DEFAULT_SUPPORT_EMAIL, type ContactInput } from "@/modules/settings/contact";
import { sendContactMessage, type ContactResult } from "@/modules/settings/server/actions";

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

/// Écrire à l'assistance : un souci, une question, une idée. Le message part par email ; si l'envoi n'est
/// pas possible, on le dit clairement et on propose d'écrire depuis sa propre messagerie.
export function ContactForm() {
  const [category, setCategory] = useState<ContactInput["category"]>("probleme");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContactResult | null>(null);

  if (result) {
    const mailto = `mailto:${DEFAULT_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    return (
      <div className="space-y-3 rounded-xl border border-border p-5">
        <div className={cn("flex items-center gap-2 text-sm font-medium", result.emailed ? "text-good" : "text-important")}>
          <CheckCircle2 size={18} aria-hidden="true" />
          {result.emailed ? "Message envoyé. On te répond dès que possible." : "Message enregistré, mais pas encore envoyé par email."}
        </div>
        {!result.emailed && (
          <p className="text-sm text-muted-foreground">
            {result.reason === "not_configured"
              ? "L'envoi automatique d'emails n'est pas encore configuré sur cette installation."
              : "L'envoi a échoué pour l'instant."}{" "}
            Pour être sûr que ça arrive, tu peux l&apos;envoyer toi-même depuis ta messagerie :
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {!result.emailed && (
            <Button asChild size="sm">
              <a href={mailto}>
                <Mail size={14} aria-hidden="true" />
                Écrire depuis ma messagerie
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setResult(null);
              setSubject("");
              setMessage("");
            }}
          >
            Écrire un autre message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          setResult(await sendContactMessage({ category, subject, message }));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Une erreur est survenue.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <span className="text-sm font-medium">C&apos;est à propos de…</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type de message">
          {CONTACT_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={category === c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                category === c.key ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="contact-subject" className="text-sm font-medium">
          Titre
        </label>
        <input id="contact-subject" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="ex : Je n'arrive plus à ouvrir le planning" className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium">
          Ton message
        </label>
        <textarea
          id="contact-message"
          rows={6}
          value={message}
          maxLength={3000}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Explique ce qui se passe : sur quelle page, ce que tu as fait, ce que tu vois."
          className={field}
        />
      </div>
      {error && (
        <p className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || subject.trim().length < 3 || message.trim().length < 10}>
        {pending ? "Envoi…" : "Envoyer"}
      </Button>
      <p className="text-xs text-muted-foreground">Ton nom, ton établissement et ton rôle sont joints automatiquement au message.</p>
    </form>
  );
}
