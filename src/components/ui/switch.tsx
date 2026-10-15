"use client";

import { cn } from "@/lib/utils";

/// Interrupteur façon iPhone : vert quand c'est activé, gris quand c'est désactivé.
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /// Nom accessible (lu par les lecteurs d'écran) ; l'interrupteur n'a pas de texte visible.
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent outline-none transition-colors duration-200",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-good" : "bg-muted-foreground/25"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
