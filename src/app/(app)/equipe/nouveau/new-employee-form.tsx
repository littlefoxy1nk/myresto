"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  createEmployee,
  type CreateEmployeeState,
  type CreateEmployeeValues,
} from "@/modules/staff/server/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { CheckCircle2 } from "lucide-react";

const DAYS = [
  { value: "1", label: "Lun" },
  { value: "2", label: "Mar" },
  { value: "3", label: "Mer" },
  { value: "4", label: "Jeu" },
  { value: "5", label: "Ven" },
  { value: "6", label: "Sam" },
  { value: "7", label: "Dim" },
];

const EMPTY_EMPLOYEE_VALUES: CreateEmployeeValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  roleId: "",
  jobTitle: "",
  availableDays: [],
};

const INITIAL_STATE: CreateEmployeeState = { values: EMPTY_EMPLOYEE_VALUES, attempt: 0 };

export function NewEmployeeForm({ roles }: { roles: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(createEmployee, INITIAL_STATE);
  const firstErrorFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) firstErrorFieldRef.current?.focus();
    if (state.success) toast(`${state.success.name} ajouté(e) à l'équipe`);
  }, [state.attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.success) {
    return (
      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-good">
          <CheckCircle2 size={20} aria-hidden="true" />
          <p className="text-sm font-medium">{state.success.name} a été ajouté(e) à l&apos;équipe.</p>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <p className="text-xs text-muted-foreground">Mot de passe temporaire</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wide">{state.success.tempPassword}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Communiquez-le à l&apos;employé — il ne sera plus affiché ensuite.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/equipe">Retour à l&apos;équipe</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const v = state.values;
  const errors = state.fieldErrors ?? {};
  const firstErrorKey = Object.keys(errors)[0] as keyof CreateEmployeeValues | undefined;

  return (
    <form key={state.attempt} action={formAction} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      {state.error && (
        <p className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent" role="alert">
          {state.error}
        </p>
      )}

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
      <Field label="Téléphone" name="phone" type="tel" defaultValue={v.phone} error={errors.phone} />

      <div className="space-y-1.5">
        <label htmlFor="roleId" className="text-sm font-medium">
          Rôle
        </label>
        <select
          id="roleId"
          name="roleId"
          defaultValue={v.roleId}
          className={cn(
            "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent",
            errors.roleId ? "border-urgent" : "border-border"
          )}
        >
          <option value="" disabled>
            Choisir un rôle
          </option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
        {errors.roleId && <p className="text-xs text-urgent">{errors.roleId}</p>}
      </div>

      <Field label="Poste (optionnel)" name="jobTitle" defaultValue={v.jobTitle} placeholder="ex: Cheffe de rang" />

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Disponibilités habituelles (optionnel)</span>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <label
              key={day.value}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2"
            >
              <input
                type="checkbox"
                name="availableDays"
                value={day.value}
                defaultChecked={v.availableDays.includes(day.value)}
                className="sr-only"
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Création en cours…" : "Ajouter l'employé"}
      </Button>
    </form>
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
  const id = `employee-field-${name}`;
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
