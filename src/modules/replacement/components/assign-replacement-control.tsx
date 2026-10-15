"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { resolveReplacementRequest } from "@/modules/replacement/server/actions";
import type { EligibleCandidate } from "@/modules/replacement/types";

/// Le manager choisit toujours qui prend le shift — même liste factuelle pour tout le
/// monde (aucun classement), qu'une personne se soit portée volontaire ou non.
export function AssignReplacementControl({ requestId, candidates }: { requestId: string; candidates: EligibleCandidate[] }) {
  const [selected, setSelected] = useState(candidates.find((c) => c.hasVolunteered)?.membershipId ?? candidates[0]?.membershipId ?? "");
  const [pending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return <p className="text-xs text-muted-foreground">Aucun candidat éligible pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-2xl border border-border bg-card/80 px-3 py-1.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
      >
        {candidates.map((c) => (
          <option key={c.membershipId} value={c.membershipId}>
            {c.firstName} {c.lastName}
            {c.hasVolunteered ? " · volontaire" : ""}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={pending || !selected}
        onClick={() => {
          startTransition(async () => {
            try {
              await resolveReplacementRequest(requestId, selected);
              toast("Remplaçant assigné");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
            }
          });
        }}
      >
        {pending ? "…" : "Assigner"}
      </Button>
    </div>
  );
}
