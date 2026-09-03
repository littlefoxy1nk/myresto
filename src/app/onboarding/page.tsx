"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createEstablishment,
  type OnboardingState,
  type OnboardingValues,
} from "@/lib/actions/onboarding-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INITIAL_STATE: OnboardingState = {
  attempt: 0,
  values: {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    establishmentName: "",
    establishmentType: "restaurant",
    tableCount: "12",
    openTime: "12:00",
    closeTime: "23:00",
  },
};

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(createEstablishment, INITIAL_STATE);
  const errorBannerRef = useRef<HTMLParagraphElement>(null);
  const firstErrorFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.error) return;
    // Priorité au champ en erreur le plus pertinent (ex: email déjà utilisé) ; à défaut,
    // on ramène au moins l'attention sur le message d'erreur lui-même.
    if (firstErrorFieldRef.current) {
      firstErrorFieldRef.current.focus();
    } else {
      errorBannerRef.current?.focus();
    }
    // state.attempt change à chaque soumission, y compris en cas d'erreur identique.
  }, [state.attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = state.values;
  const errors = state.fieldErrors ?? {};
  const firstErrorKey = Object.keys(errors)[0] as keyof OnboardingValues | undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-foreground">
            M
          </div>
          <h1 className="text-xl font-semibold">Parlons de votre établissement</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deux minutes pour avoir une première version utilisable.
          </p>
        </div>

        {/* La key force un remontage du formulaire à chaque tentative pour que les
            defaultValue (non contrôlés) reflètent bien les valeurs déjà saisies. */}
        <form
          key={state.attempt}
          action={formAction}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          {state.error && (
            <p
              ref={errorBannerRef}
              tabIndex={-1}
              className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent outline-none"
            >
              {state.error}
            </p>
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Vous</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Prénom"
                name="firstName"
                required
                defaultValue={v.firstName}
                error={errors.firstName}
                inputRef={firstErrorKey === "firstName" ? firstErrorFieldRef : undefined}
              />
              <Field
                label="Nom"
                name="lastName"
                required
                defaultValue={v.lastName}
                error={errors.lastName}
                inputRef={firstErrorKey === "lastName" ? firstErrorFieldRef : undefined}
              />
            </div>
            <Field
              label="Email"
              name="email"
              type="email"
              required
              defaultValue={v.email}
              error={errors.email}
              inputRef={firstErrorKey === "email" ? firstErrorFieldRef : undefined}
            />
            <Field
              label="Mot de passe"
              name="password"
              type="password"
              required
              minLength={8}
              defaultValue={v.password}
              error={errors.password}
              inputRef={firstErrorKey === "password" ? firstErrorFieldRef : undefined}
            />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Votre établissement</legend>
            <Field
              label="Nom de l'établissement"
              name="establishmentName"
              required
              defaultValue={v.establishmentName}
              error={errors.establishmentName}
              inputRef={firstErrorKey === "establishmentName" ? firstErrorFieldRef : undefined}
            />
            <div className="space-y-1.5">
              <label htmlFor="establishmentType" className="text-sm font-medium">
                Type
              </label>
              <select
                id="establishmentType"
                name="establishmentType"
                defaultValue={v.establishmentType}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="brasserie">Brasserie</option>
                <option value="cafe">Café</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field
                label="Nombre de tables"
                name="tableCount"
                type="number"
                defaultValue={v.tableCount}
                min={1}
                max={60}
                required
              />
              <Field label="Ouverture" name="openTime" type="time" defaultValue={v.openTime} required />
              <Field label="Fermeture" name="closeTime" type="time" defaultValue={v.closeTime} required />
            </div>
          </fieldset>

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Création en cours…" : "Créer mon établissement"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  error,
  inputRef,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  [key: string]: unknown;
}) {
  const id = `field-${name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        ref={inputRef}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent",
          error ? "border-urgent" : "border-border"
        )}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-urgent">
          {error}
        </p>
      )}
    </div>
  );
}
