/// Le "bonhomme" de chaque personne : quelques choix simples (sexe, peau, cheveux, coiffure, yeux),
/// stockés en JSON sur la fiche utilisateur et dessinés en SVG par components/ui/avatar-figure.tsx.

export const AVATAR_GENDERS = [
  { key: "woman", label: "Femme" },
  { key: "man", label: "Homme" },
] as const;

export const AVATAR_SKINS = [
  { key: "porcelain", label: "Très claire", color: "#fbe3d3" },
  { key: "fair", label: "Claire", color: "#f4cdb0" },
  { key: "medium", label: "Mate", color: "#e0a97d" },
  { key: "olive", label: "Olive", color: "#c58c5f" },
  { key: "brown", label: "Brune", color: "#8f5c3b" },
  { key: "dark", label: "Foncée", color: "#5b3a26" },
] as const;

export const AVATAR_HAIR_COLORS = [
  { key: "black", label: "Noirs", color: "#2a2220" },
  { key: "brown", label: "Bruns", color: "#4b3226" },
  { key: "chestnut", label: "Châtains", color: "#7b4a2a" },
  { key: "blond", label: "Blonds", color: "#dcb86e" },
  { key: "red", label: "Roux", color: "#b4491f" },
  { key: "grey", label: "Gris", color: "#b5b5b5" },
] as const;

export const AVATAR_HAIR_STYLES = [
  { key: "short", label: "Courts" },
  { key: "bob", label: "Carré" },
  { key: "long", label: "Longs" },
  { key: "bun", label: "Chignon" },
  { key: "ponytail", label: "Queue de cheval" },
  { key: "curly", label: "Bouclés" },
  { key: "bald", label: "Rasés" },
] as const;

export const AVATAR_EYE_COLORS = [
  { key: "brown", label: "Marron", color: "#6b4423" },
  { key: "hazel", label: "Noisette", color: "#8a6a2b" },
  { key: "green", label: "Verts", color: "#4a8a5a" },
  { key: "blue", label: "Bleus", color: "#3b7fc4" },
  { key: "grey", label: "Gris", color: "#7d8a96" },
] as const;

export type AvatarGender = (typeof AVATAR_GENDERS)[number]["key"];
export type AvatarSkin = (typeof AVATAR_SKINS)[number]["key"];
export type AvatarHair = (typeof AVATAR_HAIR_COLORS)[number]["key"];
export type AvatarHairStyle = (typeof AVATAR_HAIR_STYLES)[number]["key"];
export type AvatarEyes = (typeof AVATAR_EYE_COLORS)[number]["key"];

export type AvatarConfig = {
  gender: AvatarGender;
  skin: AvatarSkin;
  hair: AvatarHair;
  hairStyle: AvatarHairStyle;
  eyes: AvatarEyes;
};

const keys = <T extends readonly { key: string }[]>(list: T) => list.map((o) => o.key) as T[number]["key"][];

const OPTIONS = {
  gender: keys(AVATAR_GENDERS),
  skin: keys(AVATAR_SKINS),
  hair: keys(AVATAR_HAIR_COLORS),
  hairStyle: keys(AVATAR_HAIR_STYLES),
  eyes: keys(AVATAR_EYE_COLORS),
};

/// Vrai si l'objet est un avatar complet dont chaque choix existe.
export function isAvatarConfig(value: unknown): value is AvatarConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]).every((k) => (OPTIONS[k] as string[]).includes(String(v[k])));
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/// Un avatar de départ, toujours le même pour une même personne (tiré de son identifiant) : chacun a
/// déjà un bonhomme avant d'avoir choisi le sien, et il ne change pas d'un chargement à l'autre.
export function defaultAvatar(seed: string): AvatarConfig {
  const h = hash(seed);
  const pick = <T,>(list: readonly T[], shift: number) => list[(h >>> shift) % list.length];
  return {
    gender: pick(OPTIONS.gender, 0),
    skin: pick(OPTIONS.skin, 3),
    hair: pick(OPTIONS.hair, 6),
    hairStyle: pick(OPTIONS.hairStyle.filter((s) => s !== "bald"), 9),
    eyes: pick(OPTIONS.eyes, 12),
  };
}

/// L'avatar enregistré, ou celui par défaut si rien (ou quelque chose d'invalide) n'est enregistré.
export function parseAvatar(json: string | null | undefined, seed: string): AvatarConfig {
  if (json) {
    try {
      const parsed: unknown = JSON.parse(json);
      if (isAvatarConfig(parsed)) {
        const { gender, skin, hair, hairStyle, eyes } = parsed;
        return { gender, skin, hair, hairStyle, eyes };
      }
    } catch {
      // JSON illisible : on retombe sur l'avatar par défaut
    }
  }
  return defaultAvatar(seed);
}

/// Un avatar tiré au hasard (bouton « Au hasard » de l'éditeur).
export function randomAvatar(random: () => number = Math.random): AvatarConfig {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length) % list.length];
  return {
    gender: pick(OPTIONS.gender),
    skin: pick(OPTIONS.skin),
    hair: pick(OPTIONS.hair),
    hairStyle: pick(OPTIONS.hairStyle),
    eyes: pick(OPTIONS.eyes),
  };
}

export function colorOf<T extends readonly { key: string; color: string }[]>(list: T, key: string): string {
  return (list.find((o) => o.key === key) ?? list[0]).color;
}

/// Assombrit un "#rrggbb" (ombre du cou, des oreilles).
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
