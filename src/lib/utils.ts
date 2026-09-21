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

/// Période lisible ("21 sept." ou "21 sept. – 27 sept.") à partir de deux clés
/// "yyyy-MM-dd" — utilisée partout où une période de congé s'affiche (fiche employé,
/// mon-espace, notifications) pour ne jamais laisser une date brute ISO apparaître à
/// l'écran.
export function formatDateRange(startDate: string, endDate: string): string {
  const fmt = (d: string) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00`));
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}
