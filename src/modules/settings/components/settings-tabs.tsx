import Link from "next/link";
import { cn } from "@/lib/utils";

export type SettingsTab = { key: string; label: string };

/// Onglets de Paramètres : l'onglet actif est dans l'adresse (?tab=…), donc un lien ouvre directement le bon onglet.
export function SettingsTabs({ groups, active }: { groups: { label: string; tabs: SettingsTab[] }[]; active: string }) {
  return (
    <nav aria-label="Paramètres" className="space-y-2 rounded-2xl border border-border bg-card p-3">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <p className="w-28 shrink-0 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.tabs.map((tab) => (
              <Link
                key={tab.key}
                href={`/parametres?tab=${tab.key}`}
                aria-current={active === tab.key ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  active === tab.key ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
