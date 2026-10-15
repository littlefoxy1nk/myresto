"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarFigure } from "@/components/ui/avatar-figure";
import { toast } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";
import {
  AVATAR_EYE_COLORS,
  AVATAR_GENDERS,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_SKINS,
  randomAvatar,
  type AvatarConfig,
} from "@/lib/avatar";
import { saveMyAvatar } from "@/modules/settings/server/actions";

const pill = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
    active ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
  );

function Swatches<T extends { key: string; label: string; color: string }>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: string;
  onChange: (key: T["key"]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={value === o.key}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.key)}
            className={cn(
              "h-9 w-9 rounded-full border-2 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              value === o.key ? "scale-110 border-foreground" : "border-border hover:scale-105"
            )}
            style={{ background: o.color }}
          />
        ))}
      </div>
    </div>
  );
}

/// Chacun compose son bonhomme : sexe, peau, cheveux (couleur et coiffure) et yeux, avec l'aperçu en direct.
export function AvatarEditor({ initial }: { initial: AvatarConfig }) {
  const [config, setConfig] = useState<AvatarConfig>(initial);
  const [saved, setSaved] = useState<AvatarConfig>(initial);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => setConfig((c) => ({ ...c, [key]: value }));
  const changed = JSON.stringify(config) !== JSON.stringify(saved);

  async function save() {
    setPending(true);
    try {
      await saveMyAvatar(config);
      setSaved(config);
      toast("Ton bonhomme est enregistré");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[11rem_1fr]">
      <div className="flex flex-col items-center gap-3">
        <AvatarFigure config={config} size={150} title="Aperçu de ton bonhomme" className="rounded-full ring-2 ring-border" />
        <Button type="button" size="sm" variant="secondary" onClick={() => setConfig(randomAvatar())}>
          <Dices size={14} aria-hidden="true" />
          Au hasard
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Sexe</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Sexe">
            {AVATAR_GENDERS.map((g) => (
              <button key={g.key} type="button" role="radio" aria-checked={config.gender === g.key} onClick={() => set("gender", g.key)} className={pill(config.gender === g.key)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <Swatches label="Couleur de peau" options={AVATAR_SKINS} value={config.skin} onChange={(k) => set("skin", k)} />
        <Swatches label="Couleur de cheveux" options={AVATAR_HAIR_COLORS} value={config.hair} onChange={(k) => set("hair", k)} />
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Coiffure</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Coiffure">
            {AVATAR_HAIR_STYLES.map((s) => (
              <button key={s.key} type="button" role="radio" aria-checked={config.hairStyle === s.key} onClick={() => set("hairStyle", s.key)} className={pill(config.hairStyle === s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <Swatches label="Couleur des yeux" options={AVATAR_EYE_COLORS} value={config.eyes} onChange={(k) => set("eyes", k)} />
        <Button onClick={save} disabled={pending || !changed}>
          {pending ? "Enregistrement…" : changed ? "Enregistrer mon bonhomme" : "Enregistré"}
        </Button>
      </div>
    </div>
  );
}
