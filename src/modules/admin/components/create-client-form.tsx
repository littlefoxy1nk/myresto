"use client";

import { useActionState, useState } from "react";
import { NumberStepper } from "@/components/ui/number-stepper";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { createClientEstablishment, type CreateClientState } from "@/modules/admin/server/actions";
import { InviteLinkCard } from "@/modules/admin/components/invite-link-card";

const field =
  "w-full rounded-2xl border bg-card/80 px-4 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

const INITIAL: CreateClientState = { attempt: 0 };

/// « Créer l'établissement d'un client » : le nom, le patron, son email. Il reçoit ensuite un lien pour choisir son mot de passe.
export function CreateClientForm() {
  const [state, action] = useActionState(createClientEstablishment, INITIAL);
  const [tables, setTables] = useState(12);
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-4">
      {state.created && <InviteLinkCard key={state.attempt} invite={state.created} />}

      {/* La key remet le formulaire à zéro après une création réussie. */}
      <form key={state.created ? `ok-${state.attempt}` : "form"} action={action} className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-card">
        {state.error && !state.created && (
          <p role="alert" className="rounded-2xl bg-urgent-soft px-3.5 py-2.5 text-sm font-medium text-urgent">
            {state.error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de l'établissement" name="establishmentName" error={errors.establishmentName} placeholder="ex : La Bouletterie" />
          <div className="space-y-1.5">
            <label htmlFor="adm-type" className="text-sm font-semibold">
              Type
            </label>
            <select id="adm-type" name="establishmentType" defaultValue="restaurant" className={cn(field, "border-border")}>
              <option value="restaurant">Restaurant</option>
              <option value="brasserie">Brasserie</option>
              <option value="bar">Bar</option>
              <option value="cafe">Café</option>
            </select>
          </div>
          <Field label="Prénom du patron" name="firstName" error={errors.firstName} autoComplete="off" />
          <Field label="Nom du patron" name="lastName" error={errors.lastName} autoComplete="off" />
        </div>
        <Field label="Email du patron" name="email" type="email" error={errors.email} autoComplete="off" />
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Ouverture" name="openTime" type="time" defaultValue="12:00" />
          <Field label="Fermeture" name="closeTime" type="time" defaultValue="23:00" />
          <div className="space-y-1.5">
            <span className="text-sm font-semibold">Tables</span>
            <NumberStepper value={tables} onChange={setTables} min={1} max={60} label="Nombre de tables" />
            <input type="hidden" name="tableCount" value={tables} />
          </div>
        </div>
        <SubmitButton pendingLabel="Création…">Créer l&apos;établissement et inviter le patron</SubmitButton>
      </form>
    </div>
  );
}

function Field({ label, name, error, ...rest }: { label: string; name: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `adm-${name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input id={id} name={name} required aria-invalid={error ? true : undefined} className={cn(field, error ? "border-urgent" : "border-border")} {...rest} />
      {error && <p className="text-xs text-urgent">{error}</p>}
    </div>
  );
}
