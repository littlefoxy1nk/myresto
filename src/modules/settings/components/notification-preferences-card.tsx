"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast-bus";
import { saveMyNotificationPreferences } from "@/modules/settings/server/actions";

type Category = { key: string; label: string; description: string };

/// Les notifications que la personne reçoit, par catégorie — seulement celles que ses droits lui proposent.
export function NotificationPreferencesCard({ categories, muted }: { categories: Category[]; muted: string[] }) {
  const [mutedSet, setMutedSet] = useState<Set<string>>(() => new Set(muted));
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function toggle(key: string, receive: boolean) {
    const before = mutedSet;
    const next = new Set(before);
    if (receive) next.delete(key);
    else next.add(key);
    setMutedSet(next);
    setPendingKey(key);
    try {
      await saveMyNotificationPreferences([...next]);
    } catch (err) {
      setMutedSet(before);
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {categories.map((c) => {
          const receive = !mutedSet.has(c.key);
          return (
            <li key={c.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.description}</p>
              </div>
              <Switch
                checked={receive}
                disabled={pendingKey === c.key}
                label={`${c.label} : ${receive ? "je reçois les notifications" : "notifications coupées"}`}
                onCheckedChange={(v) => toggle(c.key, v)}
              />
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Une catégorie coupée ne t&apos;envoie plus de notification dans la cloche. Les notifications déjà reçues restent visibles.
      </p>
    </div>
  );
}
