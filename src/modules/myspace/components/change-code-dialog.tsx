"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { changeMyCode } from "@/modules/myspace/server/actions";

export function ChangeCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = currentCode.length > 0 && /^[A-Za-z0-9]{4,8}$/.test(newCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Changer mon code d&apos;accès</DialogTitle>
        <DialogDescription>Le nouveau code doit contenir entre 4 et 8 caractères — lettres et chiffres acceptés.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setPending(true);
            setError(null);
            try {
              await changeMyCode({ currentCode, newCode });
              toast("Code mis à jour");
              onOpenChange(false);
              setCurrentCode("");
              setNewCode("");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="current-code" className="text-sm font-semibold">
              Code actuel
            </label>
            <input
              id="current-code"
              type="password"
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-code" className="text-sm font-semibold">
              Nouveau code
            </label>
            <input
              id="new-code"
              type="password"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
            />
          </div>

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending || !valid}>
            {pending ? "Enregistrement…" : "Changer le code"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
