"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { requestReplacement } from "@/modules/replacement/server/actions";

export function RequestReplacementButton({ shiftId, hasOpenReplacementRequest }: { shiftId: string; hasOpenReplacementRequest: boolean }) {
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState(hasOpenReplacementRequest);

  if (requested) {
    return <span className="text-xs font-medium text-important">Remplacement demandé</span>;
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-auto px-2 py-1 text-xs"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await requestReplacement(shiftId);
            setRequested(true);
            toast("Remplacement demandé");
          } catch (err) {
            toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
          }
        });
      }}
    >
      {pending ? "…" : "Je ne peux pas assurer ce service"}
    </Button>
  );
}
