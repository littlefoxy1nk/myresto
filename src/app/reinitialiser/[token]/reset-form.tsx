"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/modules/settings/server/password-reset-actions";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-pop"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          const result = await resetPassword({ token, password });
          if (result && !result.ok) setError(result.error);
        } catch (err) {
          // La redirection de Next.js passe par une exception « spéciale » qu'il ne faut pas avaler.
          if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw err;
          setError("Une erreur est survenue. Réessaie dans un instant.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="reset-password" className="text-sm font-semibold">
          Nouveau mot de passe
        </label>
        <div className="relative">
          <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <PasswordInput
            id="reset-password"
            required
            minLength={10}
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card/80 py-3 pl-11 pr-4 text-sm outline-none transition-shadow focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
          />
        </div>
        <p className="text-xs text-muted-foreground">10 caractères minimum : une phrase que tu retiens est idéale.</p>
      </div>
      {error && (
        <p className="rounded-2xl bg-urgent-soft px-3.5 py-2.5 text-sm font-medium text-urgent" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending || password.length < 10}>
        {pending ? "Enregistrement…" : "Enregistrer mon mot de passe"}
      </Button>
    </form>
  );
}
