"use client";

import { useState, useTransition } from "react";
import { toast } from "@/lib/toast-bus";
import { setEmployeeEmploymentType } from "@/modules/staff/server/actions";

const LABELS: Record<"fixe" | "flexijob", string> = { fixe: "Fixe", flexijob: "Flexijob" };

/// fixe = le manager déclare l'horaire habituel de cette personne (voir
/// EmployeeScheduleGrid) ; flexijob = elle le déclare elle-même depuis mon-espace, à
/// tout moment. Changer ce statut ne touche pas aux disponibilités déjà déclarées.
export function EmploymentTypeSelect({ membershipId, initialValue }: { membershipId: string; initialValue: "fixe" | "flexijob" }) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as "fixe" | "flexijob";
        const previous = value;
        setValue(next);
        startTransition(async () => {
          try {
            await setEmployeeEmploymentType(membershipId, next);
            toast(`Type de contrat : ${LABELS[next]}`);
          } catch (err) {
            setValue(previous);
            toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
          }
        });
      }}
      className="rounded-2xl border border-border bg-card/80 px-3 py-1.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
    >
      <option value="fixe">Fixe</option>
      <option value="flexijob">Flexijob</option>
    </select>
  );
}
