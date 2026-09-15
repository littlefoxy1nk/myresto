"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClosingDialog } from "@/modules/finance/components/closing-dialog";

function formatDate(d: string) {
  return new Intl.DateTimeFormat("fr-BE", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00`));
}

export function MissingClosings({ dates }: { dates: string[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  if (dates.length === 0) return null;

  return (
    <>
      <div className="space-y-1.5">
        {dates.map((d) => (
          <div key={d} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            <span className="capitalize text-muted-foreground">{formatDate(d)}</span>
            <Button size="sm" variant="outline" onClick={() => setEditing(d)}>
              Renseigner
            </Button>
          </div>
        ))}
      </div>
      {editing && (
        <ClosingDialog
          open={editing != null}
          onOpenChange={(open) => !open && setEditing(null)}
          date={editing}
          dateLabel={formatDate(editing)}
          initialRevenueCents={null}
          initialCovers={null}
        />
      )}
    </>
  );
}
