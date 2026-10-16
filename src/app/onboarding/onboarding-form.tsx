"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarClock, Coffee, LayoutGrid, Mail, Beer, UtensilsCrossed, Users, Wine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createEstablishment, type OnboardingState, type OnboardingValues } from "@/lib/actions/onboarding-actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { BrandMark } from "@/components/nav/brand-mark";
import { NumberStepper } from "@/components/ui/number-stepper";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

const INITIAL_STATE: OnboardingState = {
  attempt: 0,
  values: {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    inviteCode: "",
    establishmentName: "",
    establishmentType: "restaurant",
    tableCount: "12",
    openTime: "12:00",
    closeTime: "23:00",
  },
};

const TYPES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { value: "brasserie", label: "Brasserie", icon: Beer },
  { value: "bar", label: "Bar", icon: Wine },
  { value: "cafe", label: "Café", icon: Coffee },
];

const inputClass =
  "w-full rounded-2xl border bg-card/80 px-4 py-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15";

export function OnboardingForm({ requiresCode }: { requiresCode: boolean }) {
  const [state, formAction] = useActionState(createEstablishment, INITIAL_STATE);
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
    <AuthShell
      headline="Votre établissement, prêt en deux minutes."
      points={[
        { icon: LayoutGrid, text: "Vos tables placées dans une première salle" },
        { icon: CalendarClock, text: "Une page de réservation en ligne à partager" },
        { icon: Users, text: "Votre équipe invitée quand vous voulez" },
      ]}
    >
      <div className="mb-7 text-center lg:text-left">
        <BrandMark name="M" className="mb-4 inline-flex h-12 w-12 text-xl lg:hidden" />
        <h1 className="text-3xl font-bold tracking-tight">Créez votre établissement</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Deux minutes pour avoir une première version utilisable.</p>
      </div>

      {/* La key force un remontage du formulaire à chaque tentative pour que les
          defaultValue (non contrôlés) reflètent bien les valeurs déjà saisies. */}
      <form key={state.attempt} action={formAction} className="space-y-7 rounded-3xl border border-border/70 bg-card p-6 shadow-pop">
        {state.error && (
          <p ref={errorBannerRef} tabIndex={-1} className="rounded-2xl bg-urgent-soft px-3.5 py-2.5 text-sm font-medium text-urgent outline-none" role="alert">
            {state.error}
          </p>
        )}

        {requiresCode && (
          <Field
            label="Code d'invitation"
            name="inviteCode"
            required
            autoComplete="off"
            defaultValue={v.inviteCode}
            error={errors.inviteCode}
            inputRef={firstErrorKey === "inviteCode" ? firstErrorFieldRef : undefined}
          />
        )}

        <fieldset className="space-y-3.5">
          <Legend n={1}>Vous</Legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" name="firstName" autoComplete="given-name" required defaultValue={v.firstName} error={errors.firstName} inputRef={firstErrorKey === "firstName" ? firstErrorFieldRef : undefined} />
            <Field label="Nom" name="lastName" autoComplete="family-name" required defaultValue={v.lastName} error={errors.lastName} inputRef={firstErrorKey === "lastName" ? firstErrorFieldRef : undefined} />
          </div>
          <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={v.email} error={errors.email} inputRef={firstErrorKey === "email" ? firstErrorFieldRef : undefined} icon={Mail} />
          <div className="space-y-1.5">
            <label htmlFor="field-password" className="text-sm font-semibold">
              Mot de passe
            </label>
            <PasswordInput
              id="field-password"
              name="password"
              autoComplete="new-password"
              required
              minLength={10}
              defaultValue={v.password}
              aria-invalid={errors.password ? true : undefined}
              className={cn(inputClass, errors.password ? "border-urgent" : "border-border")}
              ref={firstErrorKey === "password" ? firstErrorFieldRef : undefined}
            />
            <p className={cn("text-xs", errors.password ? "text-urgent" : "text-muted-foreground")}>{errors.password ?? "10 caractères minimum : une phrase que tu retiens est idéale."}</p>
          </div>
        </fieldset>

        <fieldset className="space-y-3.5">
          <Legend n={2}>Votre établissement</Legend>
          <Field label="Nom de l'établissement" name="establishmentName" required defaultValue={v.establishmentName} error={errors.establishmentName} inputRef={firstErrorKey === "establishmentName" ? firstErrorFieldRef : undefined} />

          <div className="space-y-1.5">
            <span className="text-sm font-semibold" id="type-label">
              Type
            </span>
            <div role="radiogroup" aria-labelledby="type-label" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPES.map(({ value, label, icon: Icon }) => (
                <label key={value} className="cursor-pointer">
                  <input type="radio" name="establishmentType" value={value} defaultChecked={v.establishmentType === value} className="peer sr-only" />
                  <span className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/80 px-2 py-3.5 text-[13px] font-semibold text-foreground transition-all hover:bg-muted peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                    <Icon size={20} aria-hidden="true" />
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <TableCountField defaultValue={Number(v.tableCount) || 12} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ouverture" name="openTime" type="time" defaultValue={v.openTime} required />
            <Field label="Fermeture" name="closeTime" type="time" defaultValue={v.closeTime} required />
          </div>
          <p className="text-xs text-muted-foreground">Tu pourras ensuite découper ces horaires en plusieurs services (midi, soir…) dans Paramètres.</p>
        </fieldset>

        <SubmitButton size="lg" className="w-full" pendingLabel="Création en cours…">
          Créer mon établissement
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground lg:text-left">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-semibold text-accent underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
}

function Legend({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <legend className="mb-3.5 flex items-center gap-2.5 text-base font-bold tracking-tight">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-ink-foreground" aria-hidden="true">
        {n}
      </span>
      {children}
    </legend>
  );
}

function TableCountField({ defaultValue }: { defaultValue: number }) {
  const [count, setCount] = useState(Math.min(60, Math.max(1, defaultValue)));
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/60 px-4 py-3">
      <div>
        <p className="text-sm font-semibold">Nombre de tables</p>
        <p className="text-xs text-muted-foreground">On les place pour toi, tu pourras les déplacer.</p>
      </div>
      <NumberStepper value={count} onChange={setCount} min={1} max={60} label="Nombre de tables" />
      <input type="hidden" name="tableCount" value={count} />
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  error,
  inputRef,
  icon: Icon,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  icon?: LucideIcon;
  [key: string]: unknown;
}) {
  const id = `field-${name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />}
        <input
          id={id}
          name={name}
          type={type}
          ref={inputRef}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(inputClass, Icon && "pl-11", error ? "border-urgent" : "border-border")}
          {...rest}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-urgent">
          {error}
        </p>
      )}
    </div>
  );
}
