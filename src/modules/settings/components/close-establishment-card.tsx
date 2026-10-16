"use client";

import { useState } from "react";
import { Download, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { closeEstablishment } from "@/modules/settings/server/account-actions";

const field =
  "w-full rounded-2xl border border-border bg-card/80 px-4 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

/// « Mes données » : récupérer tout ce qu'on a saisi, puis, si on le décide, tout supprimer pour de bon.
export function CloseEstablishmentCard({ establishmentName }: { establishmentName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameMatches = confirmName.trim() === establishmentName.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await closeEstablishment({ confirmName, password });
      // En cas de succès, le serveur déconnecte et redirige : on n'arrive ici que s'il y a une erreur.
      if (result && !result.ok) setError(result.error);
    } catch (err) {
      // La redirection de Next.js passe par une exception « spéciale » qu'il ne faut pas avaler.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw err;
      setError("Une erreur est survenue. Réessaie.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-card">
        <h3 className="text-[15px] font-semibold tracking-tight">Télécharger mes données</h3>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Un fichier avec tout ce que contient ton établissement : réservations, clients, équipe, planning, finances… Les mots de passe n&apos;y figurent
          jamais. Fais-le avant de fermer ton activité.
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <a href="/api/export">
            <Download size={14} aria-hidden="true" />
            Télécharger (JSON)
          </a>
        </Button>
      </div>

      <div className="rounded-3xl border border-urgent/40 bg-urgent-soft/40 p-6">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-urgent">
          <TriangleAlert size={16} aria-hidden="true" />
          Fermer mon activité sur MYRESTO
        </h3>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Supprime définitivement l&apos;établissement et toutes ses données : réservations, clients, équipe et leurs comptes, planning, finances, photos et
          documents. <span className="font-semibold text-foreground">Rien ne pourra être récupéré.</span>
        </p>
        <Button variant="outline" size="sm" className="mt-4 border-urgent text-urgent hover:bg-urgent-soft" onClick={() => setOpen(true)}>
          Supprimer mon établissement…
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogTitle>Supprimer définitivement ?</DialogTitle>
          <DialogDescription>
            Toutes les données de « {establishmentName} » seront effacées, ainsi que les comptes de ton équipe. Cette action est irréversible.
          </DialogDescription>
          <form className="mt-4 space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <label htmlFor="close-name" className="text-sm font-semibold">
                Recopie le nom de l&apos;établissement
              </label>
              <input id="close-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={establishmentName} autoComplete="off" className={field} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="close-password" className="text-sm font-semibold">
                Ton mot de passe
              </label>
              <PasswordInput id="close-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={field} />
            </div>
            {error && (
              <p className="rounded-2xl bg-urgent-soft px-3.5 py-2.5 text-sm font-medium text-urgent" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-urgent text-white hover:opacity-90" disabled={pending || !nameMatches || !password}>
                {pending ? "Suppression…" : "Tout supprimer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
