"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
import { CheckCircle2, ChevronDown } from "lucide-react";
import { PermissionToggles } from "@/components/permissions/permission-toggles";
import { SelectableServiceGrid, type AvailabilityGridService } from "@/components/availability/editable-service-grid";
import type { PermissionKey } from "@/lib/permissions";

type RoleOption = { id: string; label: string; permissions: string[] };

/// Ce que la personne peut tenir comme poste — pas "direction", qui n'est pas un poste
/// de service qu'on coche mais une fonction d'encadrement (voir SHIFT_POSITIONS).
/// Plusieurs cases cochées = polyvalence réelle dans certains établissements ("je peux
/// être en salle, en cuisine et au bar") — voir isEligibleCandidate (replacement) et
/// Membership.skills, qui accepte déjà une liste CSV.
const SKILLS = [
  { value: "salle", label: "Salle" },
  { value: "bar", label: "Bar" },
  { value: "cuisine", label: "Cuisine" },
  { value: "plonge", label: "Plonge" },
];

const EMPTY_EMPLOYEE_VALUES: CreateEmployeeValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  roleId: "",
  jobTitle: "",
  employmentType: "fixe",
  usualCells: [],
  skills: [],
  permissions: [],
};

const INITIAL_STATE: CreateEmployeeState = { values: EMPTY_EMPLOYEE_VALUES, attempt: 0 };

export function NewEmployeeForm({ roles, services }: { roles: RoleOption[]; services: AvailabilityGridService[] }) {
  const [state, formAction, pending] = useActionState(createEmployee, INITIAL_STATE);
  const firstErrorFieldRef = useRef<HTMLInputElement>(null);
  const [roleId, setRoleId] = useState(state.values.roleId);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set(state.values.permissions as PermissionKey[]));
  const [showPermissions, setShowPermissions] = useState(false);
  const [employmentType, setEmploymentType] = useState<"fixe" | "flexijob">(state.values.employmentType);
  const [usualCells, setUsualCells] = useState<Set<string>>(
    new Set(state.values.usualCells.map((c) => `${c.dayOfWeek}:${c.serviceId}`))
  );
  const usualCellsMissing = employmentType === "fixe" && usualCells.size === 0;

  function selectRole(nextRoleId: string) {
    setRoleId(nextRoleId);
    const role = roles.find((r) => r.id === nextRoleId);
    setPermissions(new Set((role?.permissions ?? []) as PermissionKey[]));
  }

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
          <p className="text-xs text-muted-foreground">Identifiant</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wide">{state.success.username}</p>
          <p className="mt-3 text-xs text-muted-foreground">Code d&apos;accès</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wide">{state.success.code}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Communiquez ces deux informations à l&apos;employé — le code ne sera plus affiché ensuite. Il pourra le
            changer depuis son espace personnel.
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
        label="Email (optionnel)"
        name="email"
        type="email"
        defaultValue={v.email}
        error={errors.email}
        inputRef={firstErrorKey === "email" ? firstErrorFieldRef : undefined}
      />
      <p className="-mt-3 text-xs text-muted-foreground">
        Sans email, un identifiant et un code d&apos;accès seront générés automatiquement.
      </p>
      <Field label="Téléphone" name="phone" type="tel" defaultValue={v.phone} error={errors.phone} />

      <div className="space-y-1.5">
        <label htmlFor="roleId" className="text-sm font-medium">
          Rôle
        </label>
        <select
          id="roleId"
          name="roleId"
          value={roleId}
          onChange={(e) => selectRole(e.target.value)}
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
        <button
          type="button"
          onClick={() => setShowPermissions((o) => !o)}
          className="flex w-full items-center justify-between text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Droits d&apos;accès
          <ChevronDown size={16} aria-hidden="true" className={cn("transition-transform", showPermissions && "rotate-180")} />
        </button>
        <p className="text-xs text-muted-foreground">
          Pré-remplis selon le rôle choisi — désactivez ce que cette personne ne doit pas voir ou modifier.
        </p>
        {showPermissions && (
          <div className="pt-1">
            <PermissionToggles
              checked={permissions}
              onToggle={(key, next) =>
                setPermissions((prev) => {
                  const nextSet = new Set(prev);
                  if (next) nextSet.add(key);
                  else nextSet.delete(key);
                  return nextSet;
                })
              }
            />
          </div>
        )}
        {[...permissions].map((key) => (
          <input key={key} type="hidden" name="permissions" value={key} />
        ))}
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Postes tenus (optionnel)</span>
        <p className="text-xs text-muted-foreground">Cochez-en plusieurs si la personne est polyvalente.</p>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((skill) => (
            <label
              key={skill.value}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2"
            >
              <input
                type="checkbox"
                name="skills"
                value={skill.value}
                defaultChecked={v.skills.includes(skill.value)}
                className="sr-only"
              />
              {skill.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Type de contrat</span>
        <div className="flex gap-2">
          {(["fixe", "flexijob"] as const).map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2"
            >
              <input
                type="radio"
                name="employmentType"
                value={type}
                checked={employmentType === type}
                onChange={() => setEmploymentType(type)}
                className="sr-only"
              />
              {type === "fixe" ? "Fixe" : "Flexijob"}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">
          Horaire habituel{employmentType === "flexijob" ? " (optionnel)" : ""}
        </span>
        <p className="text-xs text-muted-foreground">
          {employmentType === "flexijob"
            ? "Un point de départ, modifiable ensuite par la personne elle-même depuis son espace."
            : "Les jours et services où cette personne travaille habituellement."}
        </p>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun service n&apos;est configuré pour cet établissement.</p>
        ) : (
          <SelectableServiceGrid services={services} value={usualCells} onChange={setUsualCells} />
        )}
        {[...usualCells].map((key) => (
          <input key={key} type="hidden" name="usualCells" value={key} />
        ))}
        {usualCellsMissing && (
          <p className="text-xs text-urgent">
            Renseignez au moins un créneau — c&apos;est l&apos;horaire de la personne, requis sauf pour un statut flexijob.
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || usualCellsMissing}>
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
