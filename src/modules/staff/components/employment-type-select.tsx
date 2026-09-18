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
      className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <option value="fixe">Fixe</option>
      <option value="flexijob">Flexijob</option>
    </select>
  );
}
