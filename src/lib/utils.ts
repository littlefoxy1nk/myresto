import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}

/// Clé de date "yyyy-MM-dd" utilisée comme identifiant de jour dans tout le produit —
/// jamais .toISOString().slice(0,10), qui décale le jour selon le fuseau.
export function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
