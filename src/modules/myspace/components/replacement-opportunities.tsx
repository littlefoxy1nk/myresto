"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { volunteerForReplacement } from "@/modules/replacement/server/actions";
import type { MyReplacementOpportunity } from "@/modules/replacement/types";

function VolunteerRow({ opportunity }: { opportunity: MyReplacementOpportunity }) {
  const [hasVolunteered, setHasVolunteered] = useState(opportunity.hasVolunteered);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="flex flex-wrap items-center justify-between gap-2 p-3">
      <div>
        <p className="text-sm font-medium">
          {opportunity.dateLabel} · {opportunity.startTime}–{opportunity.endTime}
        </p>
        <p className="text-xs text-muted-foreground">{opportunity.requestedByName} cherche un remplaçant</p>
      </div>
      {hasVolunteered ? (
        <span className="text-xs font-medium text-good">Vous vous êtes proposé(e)</span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              try {
                await volunteerForReplacement(opportunity.requestId);
                setHasVolunteered(true);
                toast("Proposition envoyée");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
              }
            });
          }}
        >
          {pending ? "…" : "Je peux le prendre"}
        </Button>
      )}
    </Card>
  );
}

export function ReplacementOpportunities({ opportunities }: { opportunities: MyReplacementOpportunity[] }) {
  if (opportunities.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Remplacements à couvrir</h2>
      <div className="space-y-2">
        {opportunities.map((o) => (
          <VolunteerRow key={o.requestId} opportunity={o} />
        ))}
      </div>
    </section>
  );
}
