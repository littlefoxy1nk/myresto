"use client";

import { cn } from "@/lib/utils";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

const CATEGORY_LABELS: Record<string, string> = {
  reservations: "Réservations & salle",
  staff: "Équipe & planning",
  finance: "Finances",
  inventory: "Stock",
  crm: "Clients",
  marketing: "Marketing",
  settings: "Paramètres",
};

const CATEGORIES = Array.from(new Set(PERMISSIONS.map((p) => p.category)));

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        checked ? "bg-good" : "bg-muted"
      )}
    >
      <span className="sr-only">{label}</span>
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

/// Liste "façon iOS" des droits, activables/désactivables individuellement — réutilise
/// le même catalogue PERMISSIONS que la matrice Rôles & permissions de /parametres
/// (lecture seule là-bas), ici éditable pour une personne précise. Chaque changement
/// remonte via `onToggle`, jamais d'état interne à synchroniser manuellement : la
/// résolution vers un rôle exact (existant ou personnalisé) se fait côté serveur, voir
/// resolveRoleForPermissions.
export function PermissionToggles({
  checked,
  onToggle,
}: {
  checked: Set<PermissionKey>;
  onToggle: (key: PermissionKey, next: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {CATEGORIES.map((category) => (
        <div key={category} className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="divide-y divide-border rounded-xl border border-border">
            {PERMISSIONS.filter((p) => p.category === category).map((perm) => (
              <div key={perm.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm">{perm.label}</span>
                <Switch checked={checked.has(perm.key)} onChange={(next) => onToggle(perm.key, next)} label={perm.label} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
