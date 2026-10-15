"use client";

import { useState } from "react";
import { Pencil, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-bus";
import { PermissionToggles } from "@/components/permissions/permission-toggles";
import { updateEmployee } from "@/modules/staff/server/actions";
import type { PermissionKey } from "@/lib/permissions";

const SKILLS = [
  { value: "salle", label: "Salle" },
  { value: "bar", label: "Bar" },
  { value: "cuisine", label: "Cuisine" },
  { value: "plonge", label: "Plonge" },
];

type RoleOption = { id: string; label: string; permissions: string[] };

/// Seul endroit qui permet au manager de revenir modifier une fiche : identité, poste,
/// objectif d'heures, postes tenus, et les droits d'accès façon iOS (voir
/// PermissionToggles) — pré-remplis avec les droits ACTUELS de la personne, pas ceux
/// d'un rôle qu'on présume. Choisir un autre rôle de base réinitialise les cases à
/// cocher à ses valeurs par défaut, sans jamais toucher à l'horaire habituel (une
/// fiche séparée, voir EmployeeScheduleGrid).
export function EditEmployeeButton({
  membershipId,
  initial,
  roles,
}: {
  membershipId: string;
  initial: {
    firstName: string;
    lastName: string;
    phone: string | null;
    jobTitle: string | null;
    weeklyHoursTarget: number | null;
    skills: string | null;
    roleId: string;
    roleIsSystem: boolean;
    currentPermissions: string[];
  };
  roles: RoleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [jobTitle, setJobTitle] = useState(initial.jobTitle ?? "");
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState(initial.weeklyHoursTarget?.toString() ?? "");
  const [skills, setSkills] = useState(new Set((initial.skills ?? "").split(",").filter(Boolean)));
  const [roleId, setRoleId] = useState(initial.roleIsSystem ? initial.roleId : (roles[0]?.id ?? ""));
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set(initial.currentPermissions as PermissionKey[]));
  const [showPermissions, setShowPermissions] = useState(false);
  const [pending, setPending] = useState(false);

  function selectRole(nextRoleId: string) {
    setRoleId(nextRoleId);
    const role = roles.find((r) => r.id === nextRoleId);
    setPermissions(new Set((role?.permissions ?? []) as PermissionKey[]));
  }

  async function submit() {
    setPending(true);
    try {
      await updateEmployee(
        membershipId,
        { firstName, lastName, phone: phone || undefined, jobTitle: jobTitle || undefined, weeklyHoursTarget: weeklyHoursTarget || undefined, roleId },
        [...permissions],
        [...skills]
      );
      toast("Fiche mise à jour");
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil size={14} aria-hidden="true" />
        Modifier
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogTitle>Modifier la fiche</DialogTitle>
          <DialogDescription>Identité, poste, compétences et droits d&apos;accès.</DialogDescription>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Prénom" value={firstName} onChange={setFirstName} />
              <TextField label="Nom" value={lastName} onChange={setLastName} />
            </div>
            <TextField label="Téléphone" value={phone} onChange={setPhone} type="tel" />
            <TextField label="Poste (intitulé)" value={jobTitle} onChange={setJobTitle} placeholder="ex: Cheffe de rang" />
            <TextField
              label="Objectif d'heures / semaine"
              value={weeklyHoursTarget}
              onChange={setWeeklyHoursTarget}
              type="number"
            />

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Postes tenus</span>
              <div className="flex flex-wrap gap-2">
                {SKILLS.map((skill) => {
                  const checked = skills.has(skill.value);
                  return (
                    <button
                      key={skill.value}
                      type="button"
                      onClick={() =>
                        setSkills((prev) => {
                          const next = new Set(prev);
                          if (checked) next.delete(skill.value);
                          else next.add(skill.value);
                          return next;
                        })
                      }
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                        checked ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground hover:bg-muted"
                      )}
                    >
                      {skill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-role" className="text-sm font-semibold">
                Rôle de base
              </label>
              <select
                id="edit-role"
                value={roleId}
                onChange={(e) => selectRole(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Changer de rôle réinitialise les droits ci-dessous à ses valeurs par défaut.</p>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setShowPermissions((o) => !o)}
                className="flex w-full items-center justify-between text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Droits d&apos;accès
                <ChevronDown size={16} aria-hidden="true" className={cn("transition-transform", showPermissions && "rotate-180")} />
              </button>
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
            </div>

            <Button className="w-full" disabled={pending || !firstName.trim() || !lastName.trim()} onClick={submit}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-border bg-card/80 px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
      />
    </div>
  );
}
