"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveTimeOffRequest, rejectTimeOffRequest } from "@/modules/timeoff/server/actions";
import { toast } from "@/lib/toast-bus";

export function TimeOffActionButton({
  requestId,
  action,
  kind = "conge",
}: {
  requestId: string;
  action: "approve" | "reject";
  kind?: "conge" | "maladie";
}) {
  const [pending, startTransition] = useTransition();
  const label =
    action === "approve" ? (kind === "maladie" ? "Marquer comme traité" : "Accepter") : kind === "maladie" ? "Contester" : "Refuser";

  return (
    <Button
      size="sm"
      variant={action === "approve" ? "secondary" : "ghost"}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            if (action === "approve") {
              await approveTimeOffRequest(requestId);
              toast(kind === "maladie" ? "Absence traitée" : "Congé accepté");
            } else {
              await rejectTimeOffRequest(requestId);
              toast(kind === "maladie" ? "Absence contestée" : "Congé refusé");
            }
          } catch (err) {
            toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
          }
        });
      }}
    >
      {pending ? "…" : label}
    </Button>
  );
}
