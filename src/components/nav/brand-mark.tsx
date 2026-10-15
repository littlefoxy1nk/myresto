import { cn } from "@/lib/utils";

/// Pastille de l'établissement : initiale sur un dégradé, utilisée dans le menu et sur mobile.
export function BrandMark({ name, className }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ee7d4b] via-[#c0451f] to-[#9f1f4d] font-bold text-white shadow-[0_6px_16px_-4px_rgb(192_69_31/0.55)]",
        className
      )}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
