"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { regenerateEmployeeCode } from "@/modules/staff/server/actions";

export function RegenerateCodeButton({ membershipId, name }: { membershipId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCode(null);
      setError(null);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => reset(true)}>
        <KeyRound size={14} aria-hidden="true" />
        Régénérer le code
      </Button>
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent>
          {code ? (
            <>
              <DialogTitle>Nouveau code généré</DialogTitle>
              <DialogDescription>
                Communiquez ce code à {name} — il ne sera plus affiché ensuite. L&apos;ancien code ne fonctionne plus.
              </DialogDescription>
              <div className="mt-4 rounded-xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">Code d&apos;accès</p>
                <p className="mt-1 font-mono text-lg font-semibold tracking-wide">{code}</p>
              </div>
              <div className="mt-5 flex justify-end">
                <Button onClick={() => reset(false)}>Fermer</Button>
              </div>
            </>
          ) : (
            <>
              <DialogTitle>Régénérer le code de {name} ?</DialogTitle>
              <DialogDescription>
                L&apos;ancien code cessera de fonctionner immédiatement, y compris s&apos;il est verrouillé après
                plusieurs échecs de connexion.
              </DialogDescription>
              {error && <p className="mt-3 text-sm text-urgent">{error}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => reset(false)}>
                  Annuler
                </Button>
                <Button
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    setError(null);
                    const result = await regenerateEmployeeCode(membershipId);
                    setPending(false);
                    if ("error" in result) {
                      setError(result.error);
                    } else {
                      setCode(result.code);
                    }
                  }}
                >
                  {pending ? "Génération…" : "Régénérer"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
