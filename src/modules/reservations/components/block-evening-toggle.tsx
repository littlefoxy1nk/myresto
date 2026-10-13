"use client";

import { useTransition } from "react";
import { toast } from "@/lib/toast-bus";
import { setBlocksEvening } from "@/modules/reservations/server/actions";

/// Sous une réservation du soir : garde la table pour toute la soirée (jusqu'à la fermeture).
export function BlockEveningToggle({
  reservationId,
  checked,
  until,
  disabled,
}: {
  reservationId: string;
  checked: boolean;
  until: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled || pending}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            try {
              await setBlocksEvening(reservationId, next);
              toast(next ? `Table bloquée jusqu'à ${until}` : "Table libérée pour la suite de la soirée");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
            }
          });
        }}
        className="h-3.5 w-3.5 accent-[var(--accent)]"
      />
      <span className={checked ? "font-medium text-foreground" : undefined}>
        Bloquer la table pour toute la soirée <span className="tabular-nums">(jusqu&apos;à {until})</span>
      </span>
    </label>
  );
}
