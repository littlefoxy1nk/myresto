import { cn } from "@/lib/utils";

/// Une couleur douce par personne, toujours la même pour un même nom (pas de hasard à l'affichage).
const TONES = [
  "bg-salle-soft text-salle",
  "bg-cuisine-soft text-cuisine",
  "bg-bar-soft text-bar",
  "bg-plonge-soft text-plonge",
  "bg-direction-soft text-direction",
];

export function toneIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % TONES.length;
}

export function InitialsAvatar({ firstName, lastName, className }: { firstName: string; lastName: string; className?: string }) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold", TONES[toneIndex(`${firstName} ${lastName}`)], className)}
    >
      {initials}
    </span>
  );
}
