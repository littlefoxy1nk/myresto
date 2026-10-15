"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { respondToCoverageRequest } from "@/modules/planning/server/actions";
import { SHIFT_POSITION_LABELS, type ShiftPosition } from "@/modules/planning/types";
import type { MyCoverageRequest } from "@/modules/myspace/types";

function CoverageRequestRow({ request, onResolved }: { request: MyCoverageRequest; onResolved: (id: string) => void }) {
  const [pending, startTransition] = useTransition();

  function respond(accept: boolean) {
    startTransition(async () => {
      try {
        await respondToCoverageRequest(request.id, accept);
        onResolved(request.id);
        toast(accept ? "Service ajouté à votre planning" : "Réponse envoyée");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
      }
    });
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-2 p-3">
      <div>
        <p className="text-sm font-medium">
          {request.dateLabel} · {request.startTime}–{request.endTime}
        </p>
        <p className="text-xs text-muted-foreground">
          {SHIFT_POSITION_LABELS[request.position as ShiftPosition] ?? request.position}
          {request.serviceName ? ` · ${request.serviceName}` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => respond(false)}>
          Je ne peux pas
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={() => respond(true)}>
          {pending ? "…" : "Je peux le faire"}
        </Button>
      </div>
    </Card>
  );
}

/// Demandes ponctuelles du manager pour couvrir un creux ("tu peux faire jeudi soir ?")
/// — jamais un shift déjà planifié qu'on nous imposerait : la personne reste seule
/// décisionnaire, voir CoverageRequest dans schema.prisma.
export function CoverageRequestsList({ requests }: { requests: MyCoverageRequest[] }) {
  const [items, setItems] = useState(requests);
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold tracking-tight">Le patron vous demande un renfort</h2>
      <div className="space-y-2">
        {items.map((r) => (
          <CoverageRequestRow key={r.id} request={r} onResolved={(id) => setItems((prev) => prev.filter((x) => x.id !== id))} />
        ))}
      </div>
    </section>
  );
}
