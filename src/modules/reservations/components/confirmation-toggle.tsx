"use client";

import { useTransition } from "react";
import { Check, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { setConfirmationState } from "@/modules/reservations/server/confirmation";

type State = "none" | "asked" | "confirmed";

/// V = le client a confirmé · ? = message envoyé, pas de nouvelle. Un second clic sur la
/// pastille active la désactive.
export function ConfirmationToggle({
  reservationId,
  state,
  editable,
}: {
  reservationId: string;
  state: State;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function set(next: State) {
    startTransition(async () => {
      try {
        await setConfirmationState(reservationId, state === next ? "none" : next);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
      }
    });
  }

  const base =
    "flex h-7 w-7 items-center justify-center rounded-full border text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default";

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Confirmation du client">
      <button
        type="button"
        disabled={!editable || pending}
        onClick={() => set("confirmed")}
        aria-pressed={state === "confirmed"}
        title="Le client a confirmé"
        className={cn(
          base,
          state === "confirmed" ? "border-good bg-good text-white" : "border-border text-muted-foreground hover:bg-muted"
        )}
      >
        <Check size={14} aria-hidden="true" />
        <span className="sr-only">Confirmée par le client</span>
      </button>
      <button
        type="button"
        disabled={!editable || pending}
        onClick={() => set("asked")}
        aria-pressed={state === "asked"}
        title="Pas de nouvelle du client"
        className={cn(
          base,
          state === "asked" ? "border-important bg-important text-white" : "border-border text-muted-foreground hover:bg-muted"
        )}
      >
        <HelpCircle size={14} aria-hidden="true" />
        <span className="sr-only">Pas de nouvelle</span>
      </button>
    </div>
  );
}
