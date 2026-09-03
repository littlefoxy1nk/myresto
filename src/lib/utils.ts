import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}
