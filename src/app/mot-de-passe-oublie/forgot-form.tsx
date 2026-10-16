"use client";

import { useState } from "react";
import { MailCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/modules/settings/server/password-reset-actions";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="page-in rounded-3xl border border-border/70 bg-card p-8 text-center shadow-pop">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good">
          <MailCheck size={26} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Regarde tes emails</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Si un compte existe avec <span className="font-semibold text-foreground">{email}</span>, tu vas recevoir un lien pour choisir un nouveau mot de passe. Il est valable une heure.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-pop"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          const result = await requestPasswordReset(email);
          if (result.ok) setSent(true);
          else setError(result.error);
        } catch {
          setError("Une erreur est survenue. Réessaie dans un instant.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="forgot-email" className="text-sm font-semibold">
          Ton adresse email
        </label>
        <div className="relative">
          <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="forgot-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card/80 py-3 pl-11 pr-4 text-sm outline-none transition-shadow focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
          />
        </div>
      </div>
      {error && (
        <p className="rounded-2xl bg-urgent-soft px-3.5 py-2.5 text-sm font-medium text-urgent" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending || !email}>
        {pending ? "Envoi…" : "Envoyer le lien"}
      </Button>
    </form>
  );
}
