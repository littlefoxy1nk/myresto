"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast-bus";
import { MODULES, parseDisabledModules } from "@/lib/modules";
import { setModuleEnabled } from "@/modules/settings/server/actions";

/// Une ligne par fonctionnalité, avec son interrupteur : on n'affiche que ce dont l'établissement a besoin.
export function ModulesCard({ disabledModules }: { disabledModules: string }) {
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set(parseDisabledModules(disabledModules)));
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function toggle(key: string, enabled: boolean) {
    const before = disabled;
    const next = new Set(before);
    if (enabled) next.delete(key);
    else next.add(key);
    setDisabled(next); // visible tout de suite
    setPendingKey(key);
    try {
      await setModuleEnabled(key, enabled);
    } catch (err) {
      setDisabled(before);
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {MODULES.map((m) => {
          const enabled = !disabled.has(m.key);
          return (
            <li key={m.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.description}</p>
              </div>
              <Switch
                checked={enabled}
                disabled={pendingKey === m.key}
                label={`${m.label} : ${enabled ? "activé" : "désactivé"}`}
                onCheckedChange={(v) => toggle(m.key, v)}
              />
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Désactiver une fonctionnalité la retire du menu pour toute l&apos;équipe. Rien n&apos;est supprimé : tout revient en la
        réactivant. « Aujourd&apos;hui », « Mon espace » et « Paramètres » restent toujours là.
      </p>
    </div>
  );
}
